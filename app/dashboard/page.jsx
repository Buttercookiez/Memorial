"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [memorials, setMemorials] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Form state - Initialize with empty values
  const [formData, setFormData] = useState({
    name: "",
    birth_date: "",
    death_date: "",
    cause_of_death: "",
    story: "",
    profile_image: null,
    gallery_images: [],
    video_file: null,
    music_file: null,
  });

  // Store existing file URLs when editing
  const [existingFiles, setExistingFiles] = useState({
    profile_image_file: null,
    gallery_files: [],
    video_file: null,
    music_file: null,
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showMusicPreview, setShowMusicPreview] = useState(false);

  useEffect(() => {
    // Check for saved dark mode preference
    const savedDarkMode = localStorage.getItem('dashboardDarkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }
    checkAuth();
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('dashboardDarkMode', newDarkMode.toString());
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);
    fetchMemorials(user.id);
  };

  const fetchMemorials = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("memorials")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching memorials:", error);
    } else {
      console.log("Fetched memorials:", data);
      setMemorials(data || []);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      setFormData(prev => ({ ...prev, profile_image: file }));
    } else {
      alert("Please upload PNG or JPEG files only");
    }
  };

  const handleGalleryImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => 
      file.type === "image/png" || file.type === "image/jpeg"
    );
    
    if (validFiles.length !== files.length) {
      alert("Some files were skipped. Please upload PNG or JPEG files only");
    }
    
    setFormData(prev => ({ 
      ...prev, 
      gallery_images: [...prev.gallery_images, ...validFiles] 
    }));
  };

  const removeGalleryImage = (index) => {
    setFormData(prev => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, i) => i !== index)
    }));
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setFormData(prev => ({ ...prev, video_file: file }));
    } else {
      alert("Please upload a valid video file");
    }
  };

  const handleMusicChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setFormData(prev => ({ ...prev, music_file: file }));
    } else {
      alert("Please upload a valid audio file");
    }
  };

  const uploadFile = async (file, bucket, path) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    console.log(`Uploading to ${bucket}:`, filePath);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      console.error(`Upload error for ${bucket}:`, uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    console.log(`Upload successful. Public URL:`, data.publicUrl);
    return data.publicUrl;
  };

  const deleteFileFromStorage = async (fileUrl) => {
    if (!fileUrl) {
      console.log("No file URL provided for deletion");
      return;
    }
    
    try {
      console.log("🔄 Attempting to delete file:", fileUrl);
      
      let bucket, filePath;
      
      // Method 1: Parse standard Supabase URL format
      if (fileUrl.includes('supabase.co/storage/v1/object/public/')) {
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/');
        const publicIndex = pathParts.indexOf('public');
        
        if (publicIndex !== -1 && pathParts.length > publicIndex + 2) {
          bucket = pathParts[publicIndex + 1];
          filePath = pathParts.slice(publicIndex + 2).join('/');
        }
      }
      // Method 2: Handle different URL formats
      else if (fileUrl.includes('/storage/v1/object/public/')) {
        const parts = fileUrl.split('/storage/v1/object/public/');
        if (parts.length === 2) {
          const bucketAndPath = parts[1].split('/');
          bucket = bucketAndPath[0];
          filePath = bucketAndPath.slice(1).join('/');
        }
      }
      
      console.log(`📁 Extracted - Bucket: ${bucket}, FilePath: ${filePath}`);
      
      if (!bucket || !filePath) {
        console.error("❌ Could not extract bucket or file path from URL");
        console.log("URL format might be different than expected");
        return;
      }
      
      // Delete the file
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) {
        console.error("❌ Error deleting file from storage:", error);
        if (error.message.includes('not found')) {
          console.log("File might have already been deleted or doesn't exist");
        }
      } else {
        console.log("✅ File deleted successfully from storage");
      }
    } catch (error) {
      console.error("❌ Error in deleteFileFromStorage:", error);
      console.log("Problematic file URL:", fileUrl);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      birth_date: "",
      death_date: "",
      cause_of_death: "",
      story: "",
      profile_image: null,
      gallery_images: [],
      video_file: null,
      music_file: null,
    });
    setExistingFiles({
      profile_image_file: null,
      gallery_files: [],
      video_file: null,
      music_file: null,
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const generateQRCode = async (memorialId) => {
    try {
      const url = `${window.location.origin}/memorials/${memorialId}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      return qrDataUrl;
    } catch (error) {
      console.error("Error generating QR code:", error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.birth_date || !formData.death_date) {
      alert("Please fill in required fields: Name, Birth Date, and Death Date");
      return;
    }

    setSaving(true);
    setUploading(true);

    try {
      let profileImageUrl = existingFiles.profile_image_file;
      let galleryUrls = [...existingFiles.gallery_files];
      let videoUrl = existingFiles.video_file;
      let musicUrl = existingFiles.music_file;

      console.log("🔄 Starting file uploads...");

      // Upload profile image if new file selected
      if (formData.profile_image) {
        console.log("📸 Uploading profile image...");
        // Delete old profile image if exists
        if (existingFiles.profile_image_file) {
          console.log("🗑️ Deleting old profile image...");
          await deleteFileFromStorage(existingFiles.profile_image_file);
        }
        profileImageUrl = await uploadFile(
          formData.profile_image, 
          'memorial-images', 
          `${user.id}/profile`
        );
        console.log("✅ Profile image URL:", profileImageUrl);
      }

      // Upload new gallery images
      if (formData.gallery_images.length > 0) {
        console.log("🖼️ Uploading gallery images...");
        const uploadPromises = formData.gallery_images.map((file, index) => {
          console.log(`📤 Uploading gallery image ${index + 1}:`, file.name);
          return uploadFile(file, 'memorial-images', `${user.id}/gallery`);
        });
        const newGalleryUrls = await Promise.all(uploadPromises);
        galleryUrls = [...galleryUrls, ...newGalleryUrls];
        console.log("✅ All Gallery URLs:", galleryUrls);
      }

      // Upload video if new file selected
      if (formData.video_file) {
        console.log("🎥 Uploading video...");
        // Delete old video if exists
        if (existingFiles.video_file) {
          console.log("🗑️ Deleting old video...");
          await deleteFileFromStorage(existingFiles.video_file);
        }
        videoUrl = await uploadFile(
          formData.video_file,
          'memorial-videos',
          `${user.id}/videos`
        );
        console.log("✅ Video URL:", videoUrl);
      }

      // Upload music if new file selected
      if (formData.music_file) {
        console.log("🎵 Uploading music...");
        // Delete old music if exists
        if (existingFiles.music_file) {
          console.log("🗑️ Deleting old music...");
          await deleteFileFromStorage(existingFiles.music_file);
        }
        musicUrl = await uploadFile(
          formData.music_file,
          'memorial-audio',
          `${user.id}/audio`
        );
        console.log("✅ Music URL:", musicUrl);
      }

      // Prepare memorial data
      const memorialData = {
        name: formData.name,
        birth_date: formData.birth_date,
        death_date: formData.death_date,
        cause_of_death: formData.cause_of_death,
        story: formData.story,
        profile_image_file: profileImageUrl,
        gallery_files: galleryUrls,
        video_file: videoUrl,
        music_file: musicUrl,
      };

      console.log("💾 Saving memorial data:", memorialData);

      if (editingId) {
        // Update existing memorial
        const { error } = await supabase
          .from("memorials")
          .update(memorialData)
          .eq("id", editingId);

        if (error) throw error;
        console.log("✅ Memorial updated successfully!");
        alert("Memorial updated successfully!");
      } else {
        // Create new memorial
        const { data: newMemorial, error } = await supabase
          .from("memorials")
          .insert([{ 
            ...memorialData,
            user_id: user.id,
            bird_count: 0 
          }])
          .select()
          .single();

        if (error) throw error;

        // Generate QR code
        const qrCode = await generateQRCode(newMemorial.id);
        
        // Update memorial with QR code
        if (qrCode) {
          await supabase
            .from("memorials")
            .update({ qr_link: qrCode })
            .eq("id", newMemorial.id);
        }

        console.log("✅ Memorial created successfully!");
        alert("Memorial created successfully!");
      }

      await fetchMemorials(user.id);
      resetForm();
    } catch (error) {
      console.error("❌ Error saving memorial:", error);
      alert("Error saving memorial. Please try again.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleEdit = (memorial) => {
    setFormData({
      name: memorial.name || "",
      birth_date: memorial.birth_date || "",
      death_date: memorial.death_date || "",
      cause_of_death: memorial.cause_of_death || "",
      story: memorial.story || "",
      profile_image: null,
      gallery_images: [],
      video_file: null,
      music_file: null,
    });
    
    // Store existing files so they persist when editing
    setExistingFiles({
      profile_image_file: memorial.profile_image_file,
      gallery_files: memorial.gallery_files || [],
      video_file: memorial.video_file,
      music_file: memorial.music_file,
    });
    
    setEditingId(memorial.id);
    setIsCreating(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this memorial?")) return;

    // First get the memorial to delete files from storage
    const { data: memorial } = await supabase
      .from("memorials")
      .select("*")
      .eq("id", id)
      .single();

    if (memorial) {
      // Delete all associated files from storage
      if (memorial.profile_image_file) {
        await deleteFileFromStorage(memorial.profile_image_file);
      }
      if (memorial.gallery_files) {
        for (const imageUrl of memorial.gallery_files) {
          await deleteFileFromStorage(imageUrl);
        }
      }
      if (memorial.video_file) {
        await deleteFileFromStorage(memorial.video_file);
      }
      if (memorial.music_file) {
        await deleteFileFromStorage(memorial.music_file);
      }
    }

    // Then delete the memorial record
    const { error } = await supabase
      .from("memorials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting memorial:", error);
      alert("Error deleting memorial");
    } else {
      alert("Memorial deleted successfully");
      fetchMemorials(user.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const downloadQR = async (memorial) => {
    try {
      const url = `${window.location.origin}/memorials/${memorial.id}`;
      
      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Create QR image
      const qrImage = new Image();
      qrImage.src = qrDataUrl;
      
      await new Promise((resolve) => {
        qrImage.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 600;
      canvas.height = 800;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Memorial', canvas.width / 2, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = '32px Arial';
      const name = memorial.name || 'In Loving Memory';
      ctx.fillText(name, canvas.width / 2, 160);

      ctx.fillStyle = '#cccccc';
      ctx.font = '20px Arial';
      const birthDate = formatDate(memorial.birth_date);
      const deathDate = formatDate(memorial.death_date);
      ctx.fillText(`${birthDate} — ${deathDate}`, canvas.width / 2, 200);

      ctx.fillStyle = '#ffffff';
      const qrSize = 280;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 250;
      const padding = 20;
      ctx.fillRect(qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2);
      
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#ffffff';
      ctx.font = '22px Arial';
      ctx.fillText('Scan to View Memorial', canvas.width / 2, 600);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(150, 630);
      ctx.lineTo(450, 630);
      ctx.stroke();

      ctx.fillStyle = '#999999';
      ctx.font = 'italic 18px Arial';
      ctx.fillText('Forever in our hearts', canvas.width / 2, 680);

      ctx.fillStyle = '#ffffff';
      ctx.font = '36px Arial';
      ctx.fillText('🕊️', canvas.width / 2, 730);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${memorial.name || 'memorial'}-qr-card.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error generating QR card:', error);
      alert('Error generating QR card. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[date.getMonth()];
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch (error) {
      return "Invalid date";
    }
  };

  // Remove gallery image from existing files
  const removeExistingGalleryImage = (index) => {
    const imageToRemove = existingFiles.gallery_files[index];
    setExistingFiles(prev => ({
      ...prev,
      gallery_files: prev.gallery_files.filter((_, i) => i !== index)
    }));
    // Delete from storage
    deleteFileFromStorage(imageToRemove);
  };

  const openModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedImage(null);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newGalleryFiles = [...existingFiles.gallery_files];
    const draggedItem = newGalleryFiles[draggedIndex];
    newGalleryFiles.splice(draggedIndex, 1);
    newGalleryFiles.splice(dropIndex, 0, draggedItem);

    setExistingFiles(prev => ({
      ...prev,
      gallery_files: newGalleryFiles
    }));
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'} flex items-center justify-center`}>
        <div className={`${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'}`}>
      {/* Dark Mode Toggle Button - Fixed Bottom Right */}
      <button
        onClick={toggleDarkMode}
        className={`fixed bottom-4 right-4 z-50 p-2.5 rounded-lg ${darkMode ? 'bg-white text-black' : 'bg-black text-white'} transition-all hover:scale-105 shadow-lg`}
        aria-label="Toggle dark mode"
      >
        {darkMode ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      {/* Navigation */}
      <nav className={`${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'} border-b sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <svg className={`w-6 h-6 ${darkMode ? 'text-white' : 'text-neutral-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className={`text-lg font-light ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Memorial</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className={`text-sm ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'} transition-colors`}
              >
                Home
              </Link>
              <button
                onClick={handleLogout}
                className={`text-sm ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'} transition-colors`}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl sm:text-4xl font-light ${darkMode ? 'text-white' : 'text-neutral-900'} mb-2`}>
            Memorial Dashboard
          </h1>
          <p className={`${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Manage your memorial pages</p>
        </div>

        {/* Create Button */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className={`mb-8 flex items-center gap-2 px-6 py-3 ${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-semibold">Create New Memorial</span>
          </button>
        )}

        {/* Create/Edit Form */}
        {isCreating && (
          <div className={`mb-8 ${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'} rounded-2xl shadow-lg border p-6 sm:p-8`}>
            <h2 className={`text-2xl font-light ${darkMode ? 'text-white' : 'text-neutral-900'} mb-6`}>
              {editingId ? "Edit Memorial" : "Create New Memorial"}
            </h2>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all`}
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                    Birth Date *
                  </label>
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all`}
                    style={{
                      colorScheme: darkMode ? 'dark' : 'light'
                    }}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                    Death Date *
                  </label>
                  <input
                    type="date"
                    name="death_date"
                    value={formData.death_date}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all`}
                    style={{
                      colorScheme: darkMode ? 'dark' : 'light'
                    }}
                    required
                  />
                </div>
              </div>

              {/* Cause of Death */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Cause of Death
                </label>
                <input
                  type="text"
                  name="cause_of_death"
                  value={formData.cause_of_death}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all`}
                  placeholder="Optional"
                />
              </div>

              {/* Biography */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Biography / Life Story
                </label>
                <textarea
                  name="story"
                  value={formData.story}
                  onChange={handleInputChange}
                  rows={6}
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all resize-none`}
                  placeholder="Share their story, memories, and legacy..."
                />
              </div>

              {/* Profile Image Upload */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Profile Picture (PNG/JPEG)
                </label>
                
                {/* Show new uploaded image if exists, otherwise show current or upload button */}
                {formData.profile_image ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Profile Picture (click to change):</p>
                    <label className="relative group cursor-pointer block w-32">
                      <img
                        src={URL.createObjectURL(formData.profile_image)}
                        alt="New profile"
                        className={`w-32 h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border shadow-md group-hover:opacity-60 transition-opacity`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-black'}`}>
                          Change Photo
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : existingFiles.profile_image_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Profile Picture (click to change):</p>
                    <label className="relative group cursor-pointer block w-32">
                      <img
                        src={existingFiles.profile_image_file}
                        alt="Current profile"
                        className={`w-32 h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border shadow-md group-hover:opacity-60 transition-opacity`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-black'}`}>
                          Change Photo
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all`}>
                      <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Choose Profile Picture
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Gallery Images Upload */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Gallery Photos (PNG/JPEG) - Upload Multiple
                </label>
                <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all w-full mb-4`}>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Add Gallery Photos</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    onChange={handleGalleryImagesChange}
                    className="hidden"
                  />
                </label>
                
                {/* Existing Gallery Preview */}
                {existingFiles.gallery_files.length > 0 && (
                  <div className="mt-4">
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Gallery Images (drag to reorder, click to view):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {existingFiles.gallery_files.map((imageUrl, index) => (
                        <div 
                          key={`existing-${index}`} 
                          className="relative group cursor-move"
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                        >
                          <img
                            src={imageUrl}
                            alt={`Gallery ${index + 1}`}
                            className={`w-full h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => openModal(imageUrl)}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeExistingGalleryImage(index);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          {/* Drag indicator */}
                          <div className={`absolute bottom-2 left-2 ${darkMode ? 'bg-neutral-800' : 'bg-white'} rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <svg className={`w-3 h-3 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* New Gallery Preview */}
                {formData.gallery_images.length > 0 && (
                  <div className="mt-4">
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Gallery Images to Upload:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {formData.gallery_images.map((file, index) => (
                        <div key={`new-${index}`} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Gallery ${index + 1}`}
                            className={`w-full h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border`}
                          />
                          <button
                            onClick={() => removeGalleryImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Video Upload */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Memorial Video (MP4, MOV, etc.)
                </label>
                
                {/* Show new uploaded video if exists, otherwise show current or upload button */}
                {formData.video_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Video:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            {formData.video_file.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {(formData.video_file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <video
                        src={URL.createObjectURL(formData.video_file)}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  </div>
                ) : existingFiles.video_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Video:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            Memorial Video
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Video file attached
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <video
                        src={existingFiles.video_file}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all`}>
                      <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Choose Video
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Music Upload */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Memorial Music (MP3, WAV, etc.)
                </label>
                
                {/* Show new uploaded music if exists, otherwise show current or upload button */}
                {formData.music_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Music:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            {formData.music_file.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {(formData.music_file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleMusicChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <audio
                        src={URL.createObjectURL(formData.music_file)}
                        controls
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : existingFiles.music_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Music:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            Memorial Music
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Audio file attached
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleMusicChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <audio
                        src={existingFiles.music_file}
                        controls
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all`}>
                      <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Choose Music
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleMusicChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 px-6 py-3 ${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold`}
                >
                  {saving ? (uploading ? "Uploading..." : "Saving...") : editingId ? "Update Memorial" : "Create Memorial"}
                </button>
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className={`px-6 py-3 border-2 ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} rounded-xl transition-all font-semibold`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Memorials Grid */}
        {!isCreating && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memorials.map((memorial) => (
              <div
                key={memorial.id}
                className={`${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'} rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-all`}
              >
                {/* Memorial Card Header */}
                <div className={`relative h-48 ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-950' : 'bg-gradient-to-br from-neutral-800 to-neutral-900'}`}>
                  {memorial.profile_image_file && (
                    <img
                      src={memorial.profile_image_file}
                      alt={memorial.name}
                      className="w-full h-full object-cover opacity-40"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      {memorial.profile_image_file && (
                        <img
                          src={memorial.profile_image_file}
                          alt={memorial.name}
                          className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-xl mx-auto mb-3"
                        />
                      )}
                      <h3 className="text-xl font-light text-white px-4">{memorial.name}</h3>
                    </div>
                  </div>
                </div>

                {/* Memorial Card Content */}
                <div className="p-6">
                  <div className={`flex items-center justify-between text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-4`}>
                    <span>{new Date(memorial.birth_date).getFullYear()}</span>
                    <span>—</span>
                    <span>{new Date(memorial.death_date).getFullYear()}</span>
                  </div>

                  {/* Media Indicators - Black and White */}
                  <div className="flex justify-center gap-2 mb-4">
                    {memorial.profile_image_file && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Photo</span>
                    )}
                    {memorial.gallery_files && memorial.gallery_files.length > 0 && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Gallery ({memorial.gallery_files.length})</span>
                    )}
                    {memorial.video_file && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Video</span>
                    )}
                    {memorial.music_file && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Music</span>
                    )}
                  </div>

                  {memorial.qr_link && (
                    <div className="flex justify-center mb-4">
                      <img
                        src={memorial.qr_link}
                        alt="QR Code"
                        className={`w-32 h-32 ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border rounded-lg`}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Link
                      href={`/memorials/${memorial.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block w-full px-4 py-2 ${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} text-center rounded-lg transition-all text-sm font-semibold`}
                    >
                      View Memorial
                    </Link>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleEdit(memorial)}
                        className={`px-3 py-2 border ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} rounded-lg transition-all text-sm`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => downloadQR(memorial)}
                        className={`px-3 py-2 border ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} rounded-lg transition-all text-sm`}
                      >
                        QR
                      </button>
                      <button
                        onClick={() => handleDelete(memorial.id)}
                        className={`px-3 py-2 border ${darkMode ? 'border-red-900 text-red-400 hover:bg-red-950' : 'border-red-300 text-red-600 hover:bg-red-50'} rounded-lg transition-all text-sm`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {memorials.length === 0 && !isCreating && (
          <div className="text-center py-20">
            <svg className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-neutral-700' : 'text-neutral-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className={`text-xl ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>No memorials yet</h3>
            <p className={`${darkMode ? 'text-neutral-600' : 'text-neutral-400'} text-sm`}>Create your first memorial to get started</p>
          </div>
        )}
      </div>

      {/* Gallery Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="relative max-w-4xl max-h-full w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 z-10 hover:bg-opacity-70 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <img
              src={selectedImage}
              alt="Gallery preview"
              className="w-full h-full object-contain max-h-[80vh] rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}