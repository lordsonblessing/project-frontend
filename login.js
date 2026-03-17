// Supabase login implementation
function show(el) {
  el && el.classList.remove('hidden');
}

function hide(el) {
  el && el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const submitBtn = document.getElementById('login-submit');

  function setError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    if (msg) show(errorEl);
    else hide(errorEl);
  }

  function setLoading(loading) {
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Signing in...' : 'Login';
    }
  }

  async function refreshUI() {
    try {
      const user = await window.supabaseAuth?.getUser();
      if (user) {
        submitBtn && (submitBtn.textContent = `Continue as ${user.email}`);
        show(logoutBtn);
      } else {
        submitBtn && (submitBtn.textContent = 'Login');
        hide(logoutBtn);
      }
    } catch (err) {
      console.warn('Could not get user:', err);
      submitBtn && (submitBtn.textContent = 'Login');
      hide(logoutBtn);
    }
  }

  // Check if user is already logged in
  await refreshUI();

  logoutBtn &&
    logoutBtn.addEventListener('click', async () => {
      try {
        await window.supabaseAuth?.signOut();
        setError('');
        await refreshUI();
      } catch (err) {
        console.error('Logout error:', err);
        setError('Failed to sign out. Please try again.');
      }
    });

  form &&
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const email = (emailInput?.value || '').trim();
      const password = (passwordInput?.value || '').trim();

      if (!email) {
        setError('Please enter your email.');
        emailInput && emailInput.focus();
        setLoading(false);
        return;
      }
      if (!password) {
        setError('Please enter your password.');
        passwordInput && passwordInput.focus();
        setLoading(false);
        return;
      }

      try {
        // Sign in with Supabase
        if (!window.supabaseAuth) {
          throw new Error('Supabase not initialized. Please check your configuration.');
        }

        // signIn returns { user, session } from supabase-config.js
        const data = await window.supabaseAuth.signIn(email, password);

        // data contains { user, session }
        if (data && data.user) {
          if (!data.session) {
            setError('Please confirm your email address before signing in.');
            setLoading(false);
          } else {
            // Success - redirect to home page
            window.location.href = 'index.html';
          }
        } else {
          setError('Login failed. Please check your credentials.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Login error:', err);
        const msg = err.message || '';
        if (msg.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (msg.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account before signing in.');
        } else {
          setError(msg || 'An unexpected error occurred. Please try again.');
        }
        setLoading(false);
      }
    });
});
