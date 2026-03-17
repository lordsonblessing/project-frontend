// Supabase signup implementation
function show(el) {
  el && el.classList.remove('hidden');
}

function hide(el) {
  el && el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('signup-form');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');
  const confirmInput = document.getElementById('signup-confirm');
  const errorEl = document.getElementById('signup-error');
  const submitBtn = form?.querySelector('button[type="submit"]');

  function setError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    if (msg) show(errorEl);
    else hide(errorEl);
  }

  function setLoading(loading) {
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Creating account...' : 'Create account';
    }
  }

  // Check if user is already logged in
  try {
    const session = await window.supabaseAuth?.getSession();
    if (session) {
      window.location.href = 'index.html';
      return;
    }
  } catch (err) {
    console.warn('Could not check session:', err);
  }

  form &&
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = (passwordInput?.value || '').trim();
      const confirmPassword = (confirmInput?.value || '').trim();

      if (!email) {
        setError('Please enter your email.');
        emailInput && emailInput.focus();
        setLoading(false);
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters.');
        passwordInput && passwordInput.focus();
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        confirmInput && confirmInput.focus();
        setLoading(false);
        return;
      }

      try {
        // Sign up with Supabase
        if (!window.supabaseAuth) {
          throw new Error('Supabase not initialized. Please check your configuration.');
        }

        // signUp returns { user, session } from supabase-config.js
        const data = await window.supabaseAuth.signUp(email, password);

        // data contains { user, session }
        if (data && data.user) {
          // Check if email confirmation is required (session will be null)
          if (!data.session) {
            setError('Account created! Please check your email to confirm your account.');
            setLoading(false);
          } else {
            // Success - redirect to home page
            window.location.href = 'index.html';
          }
        } else {
          setError('Account creation failed. Please try again.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Signup error:', err);
        const msg = err.message || '';
        if (msg.includes('already registered')) {
          setError('An account with that email already exists. Please sign in.');
        } else if (msg.includes('Invalid email')) {
          setError('Please enter a valid email address.');
        } else {
          setError(msg || 'An unexpected error occurred. Please try again.');
        }
        setLoading(false);
      }
    });
});
