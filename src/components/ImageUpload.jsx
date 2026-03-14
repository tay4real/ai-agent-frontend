import { useState } from 'react';

const ImageUpload = ({ setImage, image }) => {
  const [preview, setPreview] = useState(null);

  const handleUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      setPreview(reader.result);
      setImage(base64);
    };

    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImage(null);
    setPreview(null);
  };

  return (
    <div className="image-upload-container">
      <label className="image-upload-label">
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="image-upload-input"
        />
        <span className="image-upload-btn">{image ? '📷 Change Image' : '📷 Add Image'}</span>
      </label>

      {preview && (
        <div className="image-preview">
          <img src={preview} alt="Preview" />
          <button onClick={clearImage} className="clear-image-btn" title="Remove image">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
