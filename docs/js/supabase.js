class SupabaseService {
  constructor() {
    this.url = 'https://fteusrnytslaylfgemye.supabase.co';
    this.key = 'sb_publishable_2meEMOnLkAPYby7xd7Uy_w_kmHQw7dq';
    this.client = null;
    this.user = null;
  }

  async init() {
    if (typeof supabase === 'undefined') return;
    
    this.client = supabase.createClient(this.url, this.key);

    // Check for existing session in localStorage
    const { data: { session } } = await this.client.auth.getSession();

    if (session) {
      this.user = session.user;
    } else {
      await this._authenticate();
    }
    
    return this.user;
  }

  async _authenticate() {
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) return null;
    this.user = data.user;
    return this.user;
  }

  async saveScore(nickname, score, sunflowers) {
    if (!this.user) await this.init();
    if (!this.user) return;

    await this.client
      .from('leaderboard')
      .upsert({
        user_id: this.user.id,
        username: nickname || "Anonymous",
        score: score,
        sunflowers: sunflowers || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
  }

  async getLeaderboard(limit = 25) {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('leaderboard')
      .select('username, score, sunflowers, user_id, updated_at')
      .order('score', { ascending: false })
      .limit(limit);

    return error ? [] : data;
  }

async signInWithGoogle() {
  const { data, error } = await this.client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Where to redirect after successful login
      redirectTo: window.location.origin 
    }
  });

  if (error) console.error("Login error:", error.message);
}




  
  
}
