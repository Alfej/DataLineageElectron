import React, { useState, useRef } from "react";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import CloseIcon from "@mui/icons-material/Close";

interface MaximizeButtonProps {
  children: (modalContainer: HTMLElement | null) => React.ReactNode;
}

const MaximizeButton: React.FC<MaximizeButtonProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  return (
    <>
      {/* Button */}
      <button
        onClick={openModal}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "#388e3c",
          color: "#fff",
          border: "none",
          padding: "6px 12px",
          borderRadius: 6,
          cursor: "pointer",
          fontWeight: 600,
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          position: "absolute",
          top: 15,
          right: 110,
          zIndex: 1000,
        }}
        title="Open Fullscreen"
      >
        <FullscreenIcon fontSize="small" /> Maximize
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
          onClick={closeModal}
        >
          <div
            ref={modalRef}
            style={{
              position: "relative",
              background: "#fff",
              width: "95%",
              height: "95%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                zIndex: 2100,
              }}
            >
              <CloseIcon />
            </button>

            {/* ✅ Pass modal container to children */}
            {children(modalRef.current)}
          </div>
        </div>
      )}
    </>
  );
};

export default MaximizeButton;
