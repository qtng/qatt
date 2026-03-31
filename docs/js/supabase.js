class SupabaseService {
  constructor() {
    // Replace with your actual Supabase project details
    this.url = 'https://fteusrnytslaylfgemye.supabase.co';
    this.key = 'sb_publishable_2meEMOnLkAPYby7xd7Uy_w_kmHQw7dq'; //your-anon-public-key
    this.client = null;
    this.user = null;
  }

  // Initialize client and trigger anonymous auth
  async init() {
    if (typeof supabase === 'undefined') {
      console.error("Supabase SDK missing");
      return;
    }
    this.client = supabase.createClient(this.url, this.key);
    await this._authenticate();
  }

  // Signs in anonymously to obtain a unique UUID
  async _authenticate() {
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) {
      console.error("Auth error:", error.message);
      return;
    }
    this.user = data.user;
    return this.user;
  }

  // Upsert score using user_id as unique constraint
  async saveScore(nickname, score, sunflowers) {
    if (!this.user) await this._authenticate();

    const { error } = await this.client
      .from('leaderboard')
      .upsert({
        user_id: this.user.id,
        username: nickname || "Anonymous",
        score: score,
        sunflowers: sunflowers,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.error("Save error:", error.message);
  }

  // Retrieve top ranked scores
  async getLeaderboard(limit = 25) {
    const { data, error } = await this.client
      .from('leaderboard')
      .select('username, score, sunflowers, user_id')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Fetch error:", error.message);
      return [];
    }
    return data;
  }
}
