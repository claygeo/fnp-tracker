import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import '../styles/login.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

const Login = ({ onAuthChange }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Reset form state on component mount
  useEffect(() => {
    setFormData({ email: '', password: '' });
    setError('');
    setIsLoading(false);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Invalid email or password');
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('tier')
        .eq('email', authData.user.email)
        .single();

      if (userError || !userData) {
        throw new Error('User not found or tier not assigned');
      }

      const tier = userData.tier;
      if (![0, 1, 2, 3].includes(tier)) {
        throw new Error('Invalid user tier');
      }

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          user_email: authData.user.email,
          action_type: 'SIGN_IN',
          details: {}
        });
      if (auditError) {
        console.error('Failed to log sign-in to audit_logs:', auditError.message);
      }

      localStorage.setItem('username', authData.user.email);
      localStorage.setItem('userTier', tier);
      onAuthChange();
      navigate('/dashboard');
    } catch (error) {
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ email: '', password: '' });
    setError('');
  };

  return (
    <div className="login-container">
      <img src="/assets/curaleaf.png" alt="Curaleaf Logo" className="login-logo" />
      <h2>Curaleaf F&P Tracker</h2>
      {error && <p className="error-message">{error}</p>}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="e.g., main@curaleaf.com"
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter your password"
            required
            disabled={isLoading}
          />
        </div>
        <div className="buttons">
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login;