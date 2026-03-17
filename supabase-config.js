// Supabase Configuration
// Loads configuration from server environment variables via /api/config endpoint

let SUPABASE_CONFIG = {
  url: null,
  anonKey: null,
};

let configLoaded = false;
let configLoadPromise = null;
let apiBaseUrl = '';
const DEFAULT_API_BASE_URL = 'https://project-backend-v0f8.onrender.com';

function normalizeBase(url) {
  if (!url) return '';
  return String(url).replace(/\/+$/, '');
}

function buildCandidateApiBases() {
  const candidates = [];
  const hasWindow = typeof window !== 'undefined' && window.location;
  const manualBase = hasWindow
    ? normalizeBase(window.API_BASE_URL || window.RENDER_BACKEND_URL || DEFAULT_API_BASE_URL)
    : normalizeBase(DEFAULT_API_BASE_URL);

  if (manualBase) {
    candidates.push(manualBase);
  }

  if (hasWindow) {
    const fromPublicPath = /^\/public(\/|$)/.test(window.location.pathname || '/');

    if (!fromPublicPath) {
      candidates.push(window.location.origin);
    }

    if (window.location.hostname === '127.0.0.1') {
      candidates.push(`${window.location.protocol}//localhost:${window.location.port || '5500'}`);
      candidates.push(`${window.location.protocol}//localhost:5500`);
      candidates.push(`${window.location.protocol}//localhost:5501`);
    } else if (window.location.hostname === 'localhost') {
      candidates.push(`${window.location.protocol}//127.0.0.1:${window.location.port || '5500'}`);
      candidates.push(`${window.location.protocol}//127.0.0.1:5500`);
      candidates.push(`${window.location.protocol}//127.0.0.1:5501`);
    }

    if (fromPublicPath) {
      candidates.push(window.location.origin);
    }
  }

  return [...new Set(candidates.map(normalizeBase).filter(Boolean))];
}

function getApiUrl(path) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const base = normalizeBase(apiBaseUrl);
  return `${base}/${cleanPath}`;
}

// Load configuration from server
async function loadConfig() {
  if (configLoaded) return SUPABASE_CONFIG;
  if (configLoadPromise) return configLoadPromise;

  configLoadPromise = (async () => {
    const configUrls = buildCandidateApiBases().map((base) => `${base}/api/config`);

    try {
      let config = null;
      for (const url of configUrls) {
        const response = await fetch(url);
        if (!response.ok) continue;
        config = await response.json();
        apiBaseUrl = url.replace(/\/api\/config\/?$/, '');
        break;
      }

      if (!config) {
        throw new Error('Failed to load configuration');
      }

      SUPABASE_CONFIG = {
        url: config.supabaseUrl || '',
        anonKey: config.supabaseAnonKey || '',
      };
      configLoaded = true;
      return SUPABASE_CONFIG;
    } catch (error) {
      console.error('Error loading Supabase config:', error);
      if (!apiBaseUrl) {
        apiBaseUrl = normalizeBase(
          (typeof window !== 'undefined' && (window.API_BASE_URL || window.RENDER_BACKEND_URL))
            || DEFAULT_API_BASE_URL
        );
      }
      // Fallback to window variables if set (for development)
      SUPABASE_CONFIG = {
        url: window.SUPABASE_URL || '',
        anonKey: window.SUPABASE_ANON_KEY || '',
      };
      configLoaded = true;
      return SUPABASE_CONFIG;
    }
  })();

  return configLoadPromise;
}

// Initialize Supabase client
let supabaseClient = null;

function getSupabaseInitErrorMessage() {
  const hasWindow = typeof window !== 'undefined' && window.location;
  const rawPath = hasWindow ? window.location.pathname.replace(/^\/+/, '') : '';
  const currentPath = rawPath.startsWith('public/') ? rawPath.slice('public/'.length) : rawPath;
  const expectedPath = currentPath || 'signup.html';

  if (hasWindow && rawPath.startsWith('public/')) {
    return `Supabase not initialized. You opened this page from /public. Run the app with npm start and open http://localhost:5500/${expectedPath}.`;
  }

  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    return 'Supabase not initialized. Missing SUPABASE_URL or SUPABASE_ANON_KEY in server .env.';
  }

  return 'Supabase not initialized. Please check your configuration.';
}

// Function to initialize Supabase
async function initSupabase() {
  if (supabaseClient) return supabaseClient;

  // Load config first
  await loadConfig();

  // Check if Supabase is loaded
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded. Make sure to include the Supabase script in your HTML.');
    return null;
  }

  if (!SUPABASE_CONFIG.url) {
    console.warn('Supabase URL not configured. Please set SUPABASE_URL in your .env file.');
    return null;
  }

  if (!SUPABASE_CONFIG.anonKey) {
    console.warn('Supabase anon key not configured. Please set SUPABASE_ANON_KEY in your .env file.');
    return null;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return supabaseClient;
}

// Get Supabase client (async)
async function getSupabase() {
  return await initSupabase();
}

// Auth helper functions
const auth = {
  async signUp(email, password) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error(getSupabaseInitErrorMessage());

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error(getSupabaseInitErrorMessage());

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const supabase = await getSupabase();
    if (!supabase) return;

    await supabase.auth.signOut();
  },

  async getSession() {
    const supabase = await getSupabase();
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async getUser() {
    const supabase = await getSupabase();
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async onAuthStateChange(callback) {
    const supabase = await getSupabase();
    if (!supabase) return null;

    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper functions
const db = {
  // ========== Study History ==========
  async getStudyHistory(userId) {
    const supabase = await getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('study_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching study history:', error);
      return [];
    }

    return data || [];
  },

  async saveStudyHistory(userId, topic, payload) {
    const supabase = await getSupabase();
    if (!supabase) return null;

    // Check if topic already exists for this user
    const { data: existing } = await supabase
      .from('study_history')
      .select('id')
      .eq('user_id', userId)
      .eq('topic', topic)
      .single();

    if (existing) {
      // Update existing entry
      const { data, error } = await supabase
        .from('study_history')
        .update({
          payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new entry
      const { data, error } = await supabase
        .from('study_history')
        .insert({
          user_id: userId,
          topic,
          payload,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async deleteStudyHistory(userId, historyId) {
    const supabase = await getSupabase();
    if (!supabase) return;

    await supabase
      .from('study_history')
      .delete()
      .eq('id', historyId)
      .eq('user_id', userId);
  },

  async clearStudyHistory(userId) {
    const supabase = await getSupabase();
    if (!supabase) return;

    await supabase
      .from('study_history')
      .delete()
      .eq('user_id', userId);
  },

  // ========== Conversations (Chatbot) ==========
  async getConversations(userId) {
    const supabase = await getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }

    return data || [];
  },

  async saveMessage(userId, role, content) {
    const supabase = await getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        role,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving message:', error);
      return null;
    }
    return data;
  },

  async clearConversations(userId) {
    const supabase = await getSupabase();
    if (!supabase) return;

    await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId);
  },

  // ========== Profiles ==========
  async getProfile(userId) {
    const supabase = await getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  async updateProfile(userId, updates) {
    const supabase = await getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }
    return data;
  },
};

// Export for use in other files
if (typeof window !== 'undefined') {
  window.supabaseAuth = auth;
  window.supabaseDb = db;
  window.getSupabase = getSupabase;
  window.getApiUrl = getApiUrl;
}
