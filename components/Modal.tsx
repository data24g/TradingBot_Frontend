import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmText?: string;
  cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
      >
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6 text-gray-400">
          {children}
        </div>
        <div className="flex justify-end gap-4 p-4 bg-gray-900/50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 text-white font-semibold hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-800"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-accent-yellow text-gray-900 font-semibold hover:bg-accent-yellow-dark transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-yellow focus:ring-offset-gray-800"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;