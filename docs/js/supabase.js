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

  async setNickname(name) {
    name = name.trim().replace(/[^\p{L}\p{N}\s]/ug, "").replace(/[\x00-\x1F\x7F&<>"']/g, "").replace(/\s+/g, " ");
    if (name.length < 2) return;
    if (name.length > 30) name = name.substr(0, 30);
    if (!this.user) await this.init();
    if (!this.user) return;

    const { error } = await this.client
      .from('leaderboard')
      .update({
        username: name
      }).eq('user_id', this.user.id);

    if (error) console.error("Error updating nickname:", error.message);
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

  
async getHybridLeaderboard(topLimit = 20, neighborBuffer = 5) {
  if (!this.client) return [];

  let myRank = null;

  // 1. Get the current user's rank from the View
  if (this.user) {
    const { data: me } = await this.client
      .from('leaderboard_with_ranks')
      .select('rank')
      .eq('user_id', this.user.id)
      .maybeSingle();
    
    if (me) myRank = me.rank;
  }

  // 2. Build the query targeting the View
  let query = this.client
    .from('leaderboard_with_ranks')
    .select('*');

  // If user is outside the topLimit, fetch both the top list and the user's neighborhood
  if (myRank && myRank > topLimit) {
    const minNeighbor = myRank - neighborBuffer;
    const maxNeighbor = myRank + neighborBuffer;
    
    // Logic: (rank <= topLimit) OR (rank >= min AND rank <= max)
    query = query.or(`rank.lte.${topLimit},and(rank.gte.${minNeighbor},rank.lte.${maxNeighbor})`);
  } else {
    // If no user or user is already in Top X, just fetch the top limit
    query = query.lte('rank', topLimit);
  }

  // 3. Order by rank ascending (1, 2, 3...)
  const { data, error } = await query.order('rank', { ascending: true });

  if (error) {
    console.error("Error fetching hybrid leaderboard:", error.message);
    return [];
  }

  return data;
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
