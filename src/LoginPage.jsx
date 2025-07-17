import React, { useState } from 'react';
import './AzureFileExplorer.css';

const containerName = import.meta.env.VITE_LOGIN_URL;

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPopup, setForgotPopup] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.');
      return;
    }

    setError('');
    // Prepare JSON body
    const body = JSON.stringify({
      username,
      password,
      token: 'drishtee'
    });

    try {
      const response = await fetch('https://testexpenses.drishtee.in/SGCM/employee/employeeLogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      });
      const data = await response.json();
      console.log('Login response:', data);
      if (response.ok && data && data.success === true && data.data) {
        onLogin(data.data); // Pass only user data to parent
      } else {
        setError(data?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  }

  return (
    <div className="login-bg-gradient">
      <div className="login-split-container">
        <div className="login-left">
          <div className="login-logo">Logo Here</div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-label">Email</label>
            <input
              type="text"
              className="login-input"
              placeholder="login@gmail.com"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
            <div className="login-pw-row">
              <label className="login-label">Password</label>
              <span
                className="login-forgot"
                style={{ cursor: 'pointer' }}
                onClick={() => setForgotPopup(true)}
              >
                Forgot Password ?
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                className="login-input"
                placeholder="*************"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <span
                className="login-eye"
                role="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={0}
                style={{ cursor: 'pointer', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setShowPassword(s => !s)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowPassword(s => !s); }}
              >
                {showPassword ? '🙈' : '👁️'}
              </span>
            </div>
            {/* Forgot Password Popup */}
            {forgotPopup && (
              <div className="azurefe-modal-overlay">
                <div className="azurefe-modal" style={{ minWidth: 260, textAlign: 'center', padding: '2rem 1.5rem' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '1.2rem' }}>Contact HR</div>
                  <button
                    className="azurefe-modal-btn"
                    style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', cursor: 'pointer', fontWeight: 500 }}
                    onClick={() => setForgotPopup(false)}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
            {error && <div className="azurefe-error" style={{ marginTop: '0.7rem' }}>{error}</div>}
            <button className="login-btn" type="submit">LOGIN <span className="login-arrow">→</span></button>
          </form>
          {/* <div className="login-or">or continue with</div>
          <div className="login-social-row">
            <button className="login-social-btn"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" className="login-social-icon" /> </button>
            <button className="login-social-btn"><img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" className="login-social-icon" /> </button>
            <button className="login-social-btn"><img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" alt="Facebook" className="login-social-icon" /> </button>
          </div>
          <div className="login-signup-row">
            <span>Don't have an account yet? </span>
            <a href="#" className="login-signup-link">Sign up for free</a>
          </div> */}
        </div>
        <div className="login-right">
          <img src="https://cdn3d.iconscout.com/3d/premium/thumb/businessman-saying-hello-gesture-3d-illustration-download-in-png-blend-fbx-gltf-file-formats--logo-greeting-pack-business-illustrations-5042419.png" alt="login-illustration" className="login-illustration" />
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
