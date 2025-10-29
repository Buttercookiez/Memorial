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

  useEffect(() => {
    checkAuth();
  }, []);

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
    if (!fileUrl) return;
    
    try {
      // Extract the file path from the URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const bucket = pathParts[1];
      const filePath = pathParts.slice(2).join('/');
      
      console.log(`Deleting file from ${bucket}:`, filePath);
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) {
        console.error("Error deleting file:", error);
      } else {
        console.log("File deleted successfully");
      }
    } catch (error) {
      console.error("Error parsing file URL for deletion:", error);
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

      console.log("Starting file uploads...");

      // Upload profile image if new file selected
      if (formData.profile_image) {
        console.log("Uploading profile image...");
        // Delete old profile image if exists
        if (existingFiles.profile_image_file) {
          await deleteFileFromStorage(existingFiles.profile_image_file);
        }
        profileImageUrl = await uploadFile(
          formData.profile_image, 
          'memorial-images', 
          `${user.id}/profile`
        );
        console.log("Profile image URL:", profileImageUrl);
      }

      // Upload new gallery images
      if (formData.gallery_images.length > 0) {
        console.log("Uploading gallery images...");
        const uploadPromises = formData.gallery_images.map((file, index) => {
          console.log(`Uploading gallery image ${index + 1}:`, file.name);
          return uploadFile(file, 'memorial-images', `${user.id}/gallery`);
        });
        const newGalleryUrls = await Promise.all(uploadPromises);
        galleryUrls = [...galleryUrls, ...newGalleryUrls];
        console.log("All Gallery URLs:", galleryUrls);
      }

      // Upload video if new file selected
      if (formData.video_file) {
        console.log("Uploading video...");
        // Delete old video if exists
        if (existingFiles.video_file) {
          await deleteFileFromStorage(existingFiles.video_file);
        }
        videoUrl = await uploadFile(
          formData.video_file,
          'memorial-videos',
          `${user.id}/videos`
        );
        console.log("Video URL:", videoUrl);
      }

      // Upload music if new file selected
      if (formData.music_file) {
        console.log("Uploading music...");
        // Delete old music if exists
        if (existingFiles.music_file) {
          await deleteFileFromStorage(existingFiles.music_file);
        }
        musicUrl = await uploadFile(
          formData.music_file,
          'memorial-audio',
          `${user.id}/audio`
        );
        console.log("Music URL:", musicUrl);
      }

      // Prepare memorial data with CORRECT column names from your database
      const memorialData = {
        name: formData.name,
        birth_date: formData.birth_date,
        death_date: formData.death_date,
        cause_of_death: formData.cause_of_death,
        story: formData.story,
        // Using the correct column names from your database
        profile_image_file: profileImageUrl,
        gallery_files: galleryUrls,
        video_file: videoUrl,
        music_file: musicUrl,
      };

      console.log("Saving memorial data:", memorialData);

      if (editingId) {
        // Update existing memorial
        const { error } = await supabase
          .from("memorials")
          .update(memorialData)
          .eq("id", editingId);

        if (error) throw error;
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

        alert("Memorial created successfully!");
      }

      await fetchMemorials(user.id);
      resetForm();
    } catch (error) {
      console.error("Error saving memorial:", error);
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

  const downloadQR = (qrCode, name) => {
    const link = document.createElement("a");
    link.download = `${name.replace(/\s+/g, "_")}_QR.png`;
    link.href = qrCode;
    link.click();
  };

  // Remove gallery image from existing files
  const removeExistingGalleryImage = (index) => {
    const imageToRemove = existingFiles.gallery_files[index];
    setExistingFiles(prev => ({
      ...prev,
      gallery_files: prev.gallery_files.filter((_, i) => i !== index)
    }));
    // Optionally delete from storage
    deleteFileFromStorage(imageToRemove);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-neutral-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* Navigation */}
      <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-6 h-6 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-lg font-light text-neutral-900">Memorial</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors hidden sm:block"
              >
                Home
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
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
          <h1 className="text-3xl sm:text-4xl font-light text-neutral-900 mb-2">
            Memorial Dashboard
          </h1>
          <p className="text-neutral-600">Manage your memorial pages</p>
        </div>

        {/* Create Button */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="mb-8 flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-semibold">Create New Memorial</span>
          </button>
        )}

        {/* Create/Edit Form */}
        {isCreating && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 sm:p-8">
            <h2 className="text-2xl font-light text-neutral-900 mb-6">
              {editingId ? "Edit Memorial" : "Create New Memorial"}
            </h2>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Birth Date *
                  </label>
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Death Date *
                  </label>
                  <input
                    type="date"
                    name="death_date"
                    value={formData.death_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Cause of Death */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Cause of Death
                </label>
                <input
                  type="text"
                  name="cause_of_death"
                  value={formData.cause_of_death}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all"
                  placeholder="Optional"
                />
              </div>

              {/* Biography */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Biography / Life Story
                </label>
                <textarea
                  name="story"
                  value={formData.story}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Share their story, memories, and legacy..."
                />
              </div>

              {/* Profile Image Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Profile Picture (PNG/JPEG)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl hover:border-neutral-400 cursor-pointer transition-all">
                    <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-neutral-600">
                      {existingFiles.profile_image_file ? "Change Profile Picture" : "Choose Profile Picture"}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />
                  </label>
                  {formData.profile_image && (
                    <span className="text-sm text-green-600">✓ {formData.profile_image.name}</span>
                  )}
                  {!formData.profile_image && existingFiles.profile_image_file && (
                    <span className="text-sm text-blue-600">✓ Current image saved</span>
                  )}
                </div>
              </div>

              {/* Gallery Images Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Gallery Photos (PNG/JPEG) - Upload Multiple
                </label>
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl hover:border-neutral-400 cursor-pointer transition-all w-full">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-neutral-600">Add Gallery Photos</span>
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
                    <p className="text-sm text-neutral-600 mb-2">Current Gallery Images:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {existingFiles.gallery_files.map((imageUrl, index) => (
                        <div key={`existing-${index}`} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-neutral-200"
                          />
                          <button
                            onClick={() => removeExistingGalleryImage(index)}
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
                
                {/* New Gallery Preview */}
                {formData.gallery_images.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-neutral-600 mb-2">New Gallery Images to Upload:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {formData.gallery_images.map((file, index) => (
                        <div key={`new-${index}`} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-neutral-200"
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
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Memorial Video (MP4, MOV, etc.)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl hover:border-neutral-400 cursor-pointer transition-all">
                    <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-neutral-600">
                      {existingFiles.video_file ? "Change Video" : "Choose Video"}
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>
                  {formData.video_file && (
                    <span className="text-sm text-green-600">✓ {formData.video_file.name}</span>
                  )}
                  {!formData.video_file && existingFiles.video_file && (
                    <span className="text-sm text-blue-600">✓ Current video saved</span>
                  )}
                </div>
              </div>

              {/* Music Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Memorial Music (MP3, WAV, etc.)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl hover:border-neutral-400 cursor-pointer transition-all">
                    <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-sm text-neutral-600">
                      {existingFiles.music_file ? "Change Music" : "Choose Music"}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleMusicChange}
                      className="hidden"
                    />
                  </label>
                  {formData.music_file && (
                    <span className="text-sm text-green-600">✓ {formData.music_file.name}</span>
                  )}
                  {!formData.music_file && existingFiles.music_file && (
                    <span className="text-sm text-blue-600">✓ Current music saved</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {saving ? (uploading ? "Uploading..." : "Saving...") : editingId ? "Update Memorial" : "Create Memorial"}
                </button>
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="px-6 py-3 border-2 border-neutral-300 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Memorials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memorials.map((memorial) => (
            <div
              key={memorial.id}
              className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all"
            >
              {/* Memorial Card Header */}
              <div className="relative h-48 bg-gradient-to-br from-neutral-800 to-neutral-900">
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
                <div className="flex items-center justify-between text-sm text-neutral-600 mb-4">
                  <span>{new Date(memorial.birth_date).getFullYear()}</span>
                  <span>—</span>
                  <span>{new Date(memorial.death_date).getFullYear()}</span>
                </div>

                {/* Media Indicators */}
                <div className="flex justify-center gap-2 mb-4">
                  {memorial.profile_image_file && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Photo</span>
                  )}
                  {memorial.gallery_files && memorial.gallery_files.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Gallery ({memorial.gallery_files.length})</span>
                  )}
                  {memorial.video_file && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Video</span>
                  )}
                  {memorial.music_file && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">Music</span>
                  )}
                </div>

                {memorial.qr_link && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={memorial.qr_link}
                      alt="QR Code"
                      className="w-32 h-32 border border-neutral-200 rounded-lg"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Link
                    href={`/memorials/${memorial.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-2 bg-neutral-900 text-white text-center rounded-lg hover:bg-neutral-800 transition-all text-sm font-semibold"
                  >
                    View Memorial
                  </Link>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleEdit(memorial)}
                      className="px-3 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-all text-sm"
                    >
                      Edit
                    </button>
                    {memorial.qr_link && (
                      <button
                        onClick={() => downloadQR(memorial.qr_link, memorial.name)}
                        className="px-3 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-all text-sm"
                      >
                        QR
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(memorial.id)}
                      className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-all text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {memorials.length === 0 && !isCreating && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-xl text-neutral-600 mb-2">No memorials yet</h3>
            <p className="text-neutral-400 text-sm">Create your first memorial to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}