import React, { useEffect, useState, useRef } from 'react';
import { BlobServiceClient } from '@azure/storage-blob';
import { FileText, Folder, FolderPlus, Trash2, Pencil, Share2, Copy } from 'lucide-react';
import { LogOut } from 'lucide-react';
import './AzureFileExplorer.css';

const sasUrl = import.meta.env.VITE_BLOB_SERVICE_SAS_URL;
const fileServiceUrl = import.meta.env.VITE_FILE_SERVICE_URL;
const containerName = import.meta.env.VITE_CONTAINER_NAME;

// console.log("SAS URL:", import.meta.env.VITE_BLOB_SERVICE_SAS_URL);
// console.log("File Service URL:", import.meta.env.VITE_FILE_SERVICE_URL);
// console.log("Container Name:", import.meta.env.VITE_CONTAINER_NAME);


function AzureFileExplorer() {
  // Share modal state
  const [shareModal, setShareModal] = useState({ open: false, url: '', name: '' });
  function openShareModal(file) {
    setShareModal({ open: true, url: file.url, name: file.name });
  }
  function closeShareModal() {
    setShareModal({ open: false, url: '', name: '' });
  }
  function copyToClipboard() {
    if (shareModal.url) {
      navigator.clipboard.writeText(shareModal.url);
    }
  }
  // Logout handler (replace with actual logic as needed)
  function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = '/login';
  }
  // State for create folder modal
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [createFolderInput, setCreateFolderInput] = useState('');
  const [createFolderError, setCreateFolderError] = useState(false);
  // Drag-and-drop upload state
  const [dragActive, setDragActive] = useState(false);

  // Drag event handlers
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Simulate file input event
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  }
  // Helper: get breadcrumb parts from currentFolder
  function getBreadcrumbParts() {
    if (currentFolder === 'Root') return [];
    return currentFolder.split('/');
  }

  // Helper: handle breadcrumb click
  function handleBreadcrumbClick(idx) {
    if (idx === -1) {
      setCurrentFolder('Root');
    } else {
      const parts = getBreadcrumbParts().slice(0, idx + 1);
      setCurrentFolder(parts.join('/'));
    }
  }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteTargetType, setDeleteTargetType] = useState(null); // "file" or "folder"

  async function handleDeleteFile(file) {
    setDeleteTarget(file);
    setDeleteTargetType("file");
    setShowDeleteConfirm(true);
  }

  function handleDeleteFolder(folder) {
    setDeleteTarget({ name: folder.split('/').pop(), fullPath: folder });
    setDeleteTargetType("folder");
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const blobServiceClient = new BlobServiceClient(sasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      if (deleteTargetType === "file") {
        let blobName = deleteTarget.fullPath || (currentFolder === 'Root' ? deleteTarget.name : `${currentFolder}/${deleteTarget.name}`);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
      } else if (deleteTargetType === "folder") {
        // Delete .folder blob
        const folderBlobName = `${deleteTarget.fullPath}/.folder`;
        const folderBlobClient = containerClient.getBlockBlobClient(folderBlobName);
        await folderBlobClient.deleteIfExists();

        // Delete all blobs under this folder
        for await (const blob of containerClient.listBlobsFlat({ prefix: `${deleteTarget.fullPath}/` })) {
          if (!blob.name.endsWith('/.folder')) {
            const blobClient = containerClient.getBlockBlobClient(blob.name);
            await blobClient.deleteIfExists();
          }
        }
      }

      setError(null);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setDeleteTargetType(null);
      fetchBlobs();
    } catch (err) {
      setError('Delete failed: ' + err.message);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setDeleteTargetType(null);
    } finally {
      setDeleting(false);
      setLoading(false);
      setUploading(false);
      setRenamingLoading(false);
    }
  }

  function cancelDelete() {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  }
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('Root');
  const [sortOption, setSortOption] = useState('name');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderNameError, setFolderNameError] = useState(false);
  const fileInputRef = useRef(null);

  const DEFAULT_IMAGE_THUMBNAIL = "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg";
  const DEFAULT_PDF_THUMBNAIL = "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg";

  useEffect(() => {
    fetchBlobs();
    // eslint-disable-next-line
  }, [currentFolder]);

  async function fetchBlobs() {
    try {
      setLoading(true);
      const blobServiceClient = new BlobServiceClient(sasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const fetchedFiles = [];
      const fetchedFolders = new Set();

      for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
        const pathParts = blob.name.split('/');

        const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

        if (folderPath === (currentFolder === 'Root' ? '' : currentFolder)) {
          if (blob.name.endsWith('/.folder')) {
            // Skip dummy folder indicator
            continue;
          }
          const relativePath = pathParts.slice(currentFolder === 'Root' ? 0 : currentFolder.split('/').length).join('/');
          if (!relativePath.includes('/')) {
            fetchedFiles.push(createFileObj(blob, folderPath, pathParts[pathParts.length - 1]));
          }
        }

        // Collect subfolders
        if (blob.name.endsWith('/.folder')) {
          const folder = blob.name.replace('/.folder', '');
          const parent = folder.split('/').slice(0, -1).join('/') || 'Root';
          if (parent === currentFolder) {
            fetchedFolders.add(folder);
          }
        }
      }

      setFolders(currentFolder === 'Root' ? ['Root', ...Array.from(fetchedFolders)] : ['..', ...Array.from(fetchedFolders)]);
      setFiles(fetchedFiles);
    } catch (err) {
      setError('Failed to fetch files: ' + err.message);
    } finally {
      setLoading(false);
      setUploading(false);
      setDeleting(false);
      setRenamingLoading(false);
    }
  }

  function createFileObj(blob, folder, fileName) {
    return {
      name: fileName,
      size: (blob.properties.contentLength / 1024 / 1024).toFixed(2) + ' MB',
      date: new Date(blob.properties.lastModified).toLocaleString(),
      owner: 'Me',
      url: `${fileServiceUrl}${containerName}/${folder ? `${folder}/` : ''}${fileName}`,
      ext: fileName.split('.').pop().toLowerCase(),
      fullPath: folder ? `${folder}/${fileName}` : fileName,
    };
  }

  function sortFiles(list) {
    return [...list].sort((a, b) => {
      switch (sortOption) {
        case 'size': return parseFloat(b.size) - parseFloat(a.size);
        case 'date': return new Date(b.date) - new Date(a.date);
        default: return a.name.localeCompare(b.name);
      }
    });
  }

  // Always search from all files in the blob, not just current folder
  const [allFiles, setAllFiles] = useState([]);
  useEffect(() => {
    // Fetch all files once for search
    async function fetchAllFiles() {
      try {
        const blobServiceClient = new BlobServiceClient(sasUrl);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const all = [];
        setLoading(true);
        for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
          if (!blob.name.endsWith('/.folder')) {
            all.push({
              name: blob.name.split('/').pop(),
              size: (blob.properties.contentLength / 1024 / 1024).toFixed(2) + ' MB',
              date: new Date(blob.properties.lastModified).toLocaleString(),
              owner: 'Me',
              url: `${fileServiceUrl}${containerName}/${blob.name}`,
              ext: blob.name.split('.').pop().toLowerCase(),
              fullPath: blob.name
            });
          }
        }
        setAllFiles(all);
      } catch (err) {
        // ignore error for global search
      }
    }
    fetchAllFiles();
  }, []);

  const filteredFiles = search.trim()
    ? sortFiles(allFiles).filter(file => file.name.toLowerCase().includes(search.toLowerCase()) || file.fullPath.toLowerCase().includes(search.toLowerCase()))
    : sortFiles(files);

  function handleFolderClick(folder) {
    if (folder === '..') {
      const parts = currentFolder.split('/');
      parts.pop();
      setCurrentFolder(parts.length ? parts.join('/') : 'Root');
    } else if (folder === 'Root') {
      setCurrentFolder('Root');
    } else {
      setCurrentFolder(folder);
    }
  }

  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const blobServiceClient = new BlobServiceClient(sasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      for (const file of files) {
        setLoading(true);
        const blobName = currentFolder === 'Root' ? file.name : `${currentFolder}/${file.name}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadBrowserData(file);
        setLoading(false);
      }
      fetchBlobs();
    } catch (err) {
      setError("File upload failed: " + err.message);
    } finally {
      setUploading(false);
      setLoading(false);
      setDeleting(false);
      setRenamingLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!createFolderInput.trim()) {
      setCreateFolderError(true);
      return;
    }
    setCreateFolderError(false);
    try {
      const blobServiceClient = new BlobServiceClient(sasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const folderPath = currentFolder === 'Root' ? createFolderInput : `${currentFolder}/${createFolderInput}`;
      const folderBlobName = `${folderPath}/.folder`;
      const blockBlobClient = containerClient.getBlockBlobClient(folderBlobName);
      await blockBlobClient.upload('', 0);
      setCreateFolderInput('');
      setShowCreateFolderModal(false);
      fetchBlobs();
    } catch (err) {
      setError("Create folder failed: " + err.message);
    }
  }

  const [renaming, setRenaming] = useState({ type: null, target: null, value: '' });
  const [renamingLoading, setRenamingLoading] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Start rename for file or folder
  function startRename(type, target) {
    if (type === 'folder') return; // Disable folder rename
    setRenaming({ type, target, value: target.name });
    setShowRenameModal(true);
  }

  // Cancel rename
  function cancelRename() {
    setRenaming({ type: null, target: null, value: '' });
    setShowRenameModal(false);
  }

  // Confirm rename
  async function confirmRename() {
    if (!renaming.value.trim() || renaming.value === renaming.target.name) {
      cancelRename();
      return;
    }
    setRenamingLoading(true);
    try {
      const blobServiceClient = new BlobServiceClient(sasUrl);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      if (renaming.type === 'file') {
        // File rename: copy then delete
        const oldBlobName = renaming.target.fullPath;
        const newBlobName = oldBlobName.split('/').slice(0, -1).concat(renaming.value).join('/');
        const sourceBlob = containerClient.getBlockBlobClient(oldBlobName);
        const destBlob = containerClient.getBlockBlobClient(newBlobName);
        // Check if source blob exists
        const exists = await sourceBlob.exists();
        if (!exists) {
          setError('Rename failed: Source file does not exist.');
          setRenamingLoading(false);
          return;
        }
        await destBlob.beginCopyFromURL(sourceBlob.url);
        await sourceBlob.deleteIfExists();
      }
      setRenaming({ type: null, target: null, value: '' });
      setShowRenameModal(false);
      fetchBlobs();
    } catch (err) {
      setError('Rename failed: ' + err.message);
    } finally {
      setRenamingLoading(false);
      setLoading(false);
      setUploading(false);
      setDeleting(false);
    }
  }

  // Loader component
  function AzureFELoader() {
    return (
      <div className="azurefe-loader-overlay">
        <div className="azurefe-loader-spinner">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#60a5fa" strokeWidth="5" strokeDasharray="100" strokeDashoffset="60" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1s" repeatCount="indefinite" />
            </circle>
          </svg>
          <div className="azurefe-loader-text">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="azurefe-root" style={{ position: 'relative' }}>
      <main
        className={`azurefe-main${dragActive ? ' azurefe-drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ...existing code... */}
        {dragActive && (
          <div className="azurefe-drag-overlay">
            <div className="azurefe-drag-message">Drop files to upload</div>
          </div>
        )}
        {/* ...existing code... */}
        {/* ...existing code... */}
        {dragActive && (
          <div className="azurefe-drag-overlay">
            <div className="azurefe-drag-message">Drop files to upload</div>
          </div>
        )}
        <nav className="azurefe-breadcrumb" aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              className={currentFolder === 'Root' ? 'azurefe-current' : 'azurefe-link'}
              style={{ cursor: currentFolder === 'Root' ? 'default' : 'pointer' }}
              onClick={() => currentFolder !== 'Root' && handleBreadcrumbClick(-1)}
            >
              / Drishtee's File manager
            </span>
            {getBreadcrumbParts().map((part, idx, arr) => (
              <React.Fragment key={idx}>
                <span className="azurefe-breadcrumb-sep">/</span>
                {idx === arr.length - 1 ? (
                  <span className="azurefe-current">{part}</span>
                ) : (
                  <span
                    className="azurefe-link"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleBreadcrumbClick(idx)}
                  >
                    {part}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
          <button
            className="azurefe-logout-btn"
            type="button"
            title="Logout"
            onClick={handleLogout}
          >
            <LogOut className="lucide-log-out" size={18} /> Logout
          </button>
        </nav>

        {/* Folders List View */}
        <div className="azurefe-folderlist-main">
          <div className="azurefe-controls-top">
            <div className="azurefe-controls-row">
              <input
                type="text"
                className="azurefe-search-input-dark azurefe-input"
                placeholder="Search files and folders"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {currentFolder !== 'Root' && (
                <select
                  className="azurefe-sort-select-dark azurefe-select"
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value)}
                >
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                  <option value="date">Sort by Date</option>
                </select>
              )}
            </div>
            <div className="azurefe-actions-top azurefe-upload-topright">
              <button
                type="button"
                className="azurefe-folder-btn"
                onClick={() => { setShowCreateFolderModal(true); setCreateFolderInput(''); setCreateFolderError(false); }}>
                <FolderPlus size={16} /> Create
              </button>
              {currentFolder !== 'Root' && (
                <div className="azurefe-upload-container">
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="azurefe-file-upload-hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    className="azurefe-folder-btn"
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    Upload File
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Create Folder Modal */}
          {showCreateFolderModal && (
            <div className="azurefe-modal-overlay">
              <div className="azurefe-modal">
                <div className="azurefe-modal-title">Create New Folder</div>
                <div className="azurefe-modal-body">
                  <input
                    type="text"
                    className={`azurefe-folder-input${createFolderError ? ' azurefe-folder-input-error' : ''}`}
                    placeholder="Enter folder name"
                    value={createFolderInput}
                    onChange={e => { setCreateFolderInput(e.target.value); if (createFolderError) setCreateFolderError(false); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(e); if (e.key === 'Escape') setShowCreateFolderModal(false); }}
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <div className="azurefe-modal-actions">
                  <button className="azurefe-modal-btn" onClick={handleCreateFolder} disabled={loading}>Create</button>
                  <button className="azurefe-modal-btn azurefe-modal-btn-cancel" onClick={() => setShowCreateFolderModal(false)} disabled={loading}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {currentFolder !== 'Root' && (
            <button
              className="azurefe-back-btn"
              onClick={() => {
                const parts = currentFolder.split('/');
                parts.pop();
                setCurrentFolder(parts.length ? parts.join('/') : 'Root');
              }}
            >
              <span className="azurefe-back-arrow">&larr;</span> Back
            </button>
          )}
          <div className="azurefe-folderlist-title">Folders</div>
          <div className="azurefe-folderlist-list">
            {folders.filter(f => f !== 'Root' && f !== '..').length === 0 ? (
              <div className="azurefe-folderlist-empty">No folders found.</div>
            ) : (
              folders.filter(f => f !== 'Root' && f !== '..').map(folder => {
                const folderName = folder.split('/').pop();
                return (
                  <div
                    key={folder}
                    className={`azurefe-folderlist-item${currentFolder === folder ? ' selected' : ''}`}
                  >
                    <div
                      className="azurefe-folderlist-item-inner"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <Folder size={18} className="azurefe-folderlist-icon" />
                      <span>{folderName}</span>
                    </div>
                    <button
                      className="azurefe-delete-btn"
                      title="Delete folder"
                      onClick={() => handleDeleteFolder(folder)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {(currentFolder !== 'Root' || (currentFolder === 'Root' && search.trim() && filteredFiles.length > 0)) && (
          <div className="azurefe-table-container">
            <table className="azurefe-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Date</th>
                  <th>File</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length > 0 ? (
                  filteredFiles.map((file, index) => (
                    <tr key={index}>
                      <td>
                        {file.ext === 'jpg' || file.ext === 'jpeg' || file.ext === 'png' || file.ext === 'gif' ? (
                          <img
                            src={DEFAULT_IMAGE_THUMBNAIL}
                            alt={file.name}
                            className="azurefe-file-thumb"
                          />
                        ) : file.ext === 'pdf' ? (
                          <img
                            src={DEFAULT_PDF_THUMBNAIL}
                            alt="PDF"
                            className="azurefe-file-thumb"
                          />
                        ) : (
                          <FileText size={16} className="azurefe-filetext-icon" />
                        )}
                        <span>{file.name}</span>
                        {search.trim() && file.fullPath && (
                          <span className="azurefe-filepath">
                            {file.fullPath.includes('/') ? file.fullPath.split('/').slice(0, -1).join('/') : '/'}
                          </span>
                        )}
                      </td>
                      <td>{file.size}</td>
                      <td>{file.date}</td>
                      <td className="azurefe-action">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="azurefe-action"
                          onClick={e => {
                            // For images and PDFs, open directly in new tab
                            if (["jpg", "jpeg", "png", "gif", "pdf", "svg", "webp", "bmp"].includes(file.ext)) {
                              // Let browser handle
                            } else if (["txt", "csv", "json", "js", "jsx", "ts", "tsx", "md", "log", "xml", "html", "css"].includes(file.ext)) {
                              // Open in new tab as text
                              e.preventDefault();
                              window.open(file.url, '_blank', 'noopener');
                            } else {
                              // Let browser handle (may download)
                            }
                          }}
                        >
                          View
                        </a>
                        <button
                          className="azurefe-action-btn"
                          title="Share file"
                          style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          onClick={() => openShareModal(file)}
                        >
                          <a size={16} /> Share
                        </button>
                      </td>
                      <td className="azurefe-action">
                        <button
                          className="azurefe-folder-btn azurefe-action-btn"
                          title="Rename file"
                          onClick={() => startRename('file', file)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="azurefe-delete-btn"
                          title="Delete file"
                          onClick={() => handleDeleteFile(file)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="azurefe-table-empty"><span>No files found.</span></td>
                  </tr>
                )}
                {/* ...existing code... */}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Confirmation Modal (rendered outside table for valid React structure) */}
        {showDeleteConfirm && (
          <div className="azurefe-modal-overlay">
            <div className="azurefe-modal">
              <div className="azurefe-modal-title">
                Are you sure you want to delete <b>{deleteTarget?.name}</b> {deleteTargetType === "folder" ? "folder and all its contents" : ""}?
              </div>
              <div className="azurefe-modal-actions">
                <button className="azurefe-modal-btn azurefe-modal-btn-danger" onClick={confirmDelete}>Delete</button>
                <button className="azurefe-modal-btn" onClick={cancelDelete}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Modal */}
        {showRenameModal && (
          <div className="azurefe-modal-overlay">
            <div className="azurefe-modal">
              <div className="azurefe-modal-title">
                Rename {renaming.type === 'file' ? 'file' : 'folder'} <b>{renaming.target?.name}</b>
              </div>
              <div className="azurefe-modal-body">
                <input
                  className="azurefe-rename-input"
                  value={renaming.value}
                  onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') cancelRename(); }}
                  autoFocus
                  disabled={renamingLoading}
                  placeholder="Enter new name"
                />
              </div>
              <div className="azurefe-modal-actions">
                <button className="azurefe-modal-btn" onClick={confirmRename} disabled={renamingLoading}>OK</button>
                <button className="azurefe-modal-btn azurefe-modal-btn-cancel" onClick={cancelRename} disabled={renamingLoading}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModal.open && (
          <div className="azurefe-modal-overlay" onClick={closeShareModal}>
            <div className="azurefe-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="azurefe-modal-title">Share Link for <b>{shareModal.name}</b></div>
              <div style={{ marginBottom: '1.2rem', wordBreak: 'break-all', fontSize: '0.98rem', color: '#60a5fa', background: '#23232b', padding: '0.7rem 0.8rem', borderRadius: '6px', border: '1px solid #39394a' }}>
                {shareModal.url}
              </div>
              <div className="azurefe-modal-actions">
                <button className="azurefe-modal-btn" onClick={copyToClipboard} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Copy size={16} /> Copy Link
                </button>
                <button className="azurefe-modal-btn azurefe-modal-btn-cancel" onClick={closeShareModal}>Close</button>
              </div>
            </div>
          </div>
        )}
        {(loading || uploading || deleting || renamingLoading) && <AzureFELoader />}

        {error && <div className="azurefe-error">{error}</div>}

        {/* Usage Instructions at the very bottom in Root */}
        {currentFolder === 'Root' && (
          <div className="azurefe-usage-instructions-bottom">
            <h3 style={{ color: '#b91c1c', marginBottom: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span role="img" aria-label="info">📢</span> Usage Instructions
            </h3>
            <ul style={{ paddingLeft: '1.2rem', marginBottom: 0 }}>
              <li><span role="img" aria-label="no-edit">🚫</span> <b>Do NOT upload editable files</b> (Excel, Word, text, etc.).</li>
              <li><span role="img" aria-label="ok">✅</span> <b>Only upload non-editable files:</b> images, PDFs, and other read-only documents.</li>
              <li><span role="img" aria-label="warning">⚠️</span> Please use this tool carefully. <b>Do not misuse this tool.</b></li>
              <li><span role="img" aria-label="folder">📁</span> <b>Create Folder:</b> Click <b>Create</b>, enter a name, and click <b>Create</b>.</li>
              <li><span role="img" aria-label="upload">⬆️</span> <b>Upload File:</b> Click <b>Upload File</b> and select your file.</li>
              <li><span role="img" aria-label="drag">🖱️</span> <b>Drag and Drop:</b> Drag files into the explorer window to upload.</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default AzureFileExplorer;
