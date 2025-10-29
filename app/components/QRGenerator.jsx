"use client";
import QRCode from "react-qr-code";

export default function QRGenerator({ link }) {
  // Detect base URL (local or deployed)
  let baseURL = "";

  if (typeof window !== "undefined") {
    baseURL = window.location.origin; // auto detects domain
  }

  // Combine base URL + memorial path
  const fullLink = `${baseURL}${link}`;

  return (
    <div className="flex flex-col items-center mt-4">
      <QRCode value={fullLink} size={180} />
      <p className="mt-2 text-sm text-gray-600">Scan this to visit the memorial</p>
    </div>
  );
}
