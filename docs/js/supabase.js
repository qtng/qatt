/*
Supabase connector for app.html,
provides authentication and
access to leaderboard.

const s = new SupabaseService();
await s.saveScore(username, score, sunflowers);
await s.getLeaderboard(topLimit = 20, neighborBuffer = 5);
await s.setNickname(name);
await s.signInWithGoogle();
*/
class SupabaseService {
  
  constructor() {
    this.url = 'https://fteusrnytslaylfgemye.supabase.co';
    this.key = 'sb_publishable_2meEMOnLkAPYby7xd7Uy_w_kmHQw7dq';
    this.client = null;
    this.user = null;
  }
  
  async init() {
    if (typeof supabase === 'undefined') return;
    this.client = supabase.createClient(this.url, this.key, {
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      }
    });
    // Check for existing session in localStorage
    const {
      data: {
        session
      }
    } = await this.client.auth.getSession();
    if (session) {
      this.user = session.user;
    } else {
      await this._authenticate();
    }
    return this.user;
  }
  
  async _authenticate() {
    const {
      data,
      error
    } = await this.client.auth.signInAnonymously();
    if (error) return null;
    this.user = data.user;
    return this.user;
  }
  
  async saveScore(nickname, score, sunflowers) {
    if (!this.user) await this.init();
    if (!this.user) return;
    await this.client
      .from('profiles')
      .upsert({
        user_id: this.user.id,
        username: nickname || "Anonymous",
        score: score,
        sunflowers: sunflowers || 0,
        updated_at: new Date()
          .toISOString()
      }, {
        onConflict: 'user_id'
      });
  }

  defaultUsername(){
    if (!this.user || !this.user.id) return "Anonymous";
    const adjectives = [
        "Fast", "Cool", "Wild", "Smart", "Glad", 
        "Brave", "Soft", "Bold", "Bright", "Swift",
        "Tiny", "Fluffy", "Quick", "Light", "Noble", 
        "Sharp", "Keen", "True", "Lucky", "Free"
    ];
    const nouns = [
        "Cat", "Eagle", "Fox", "Bear", "Lion", 
        "Goose", "Camel", "Wolf", "Hare", "Owl",
        "Lynx", "Koala", "Deer", "Dino", "Squirrel", 
        "Hippo", "Raven", "Pug", "Seal", "Gecko"
    ];
    const hexPart = this.user.id.substring(0, 5);
    const val = parseInt(hexPart.substring(0, 3), 16);
    const adjIndex = val % adjectives.length;
    const nounIndex = Math.floor(val / adjectives.length) % nouns.length;
    const suffix = parseInt(hexPart.slice(3, 5), 16) || 1;
    return `${adjectives[adjIndex]}${nouns[nounIndex]}_${suffix}`;
  }
  
  async setNickname(name) {
    name = name.trim()
      .replace(/[^\p{L}\p{N}\-_\s]/ug, "")
      .replace(/[\x00-\x1F\x7F&<>"']/g, "")
      .replace(/\s+/g, " ");
    if (name.length < 2) return;
    if (name.length > 40) name = name.substr(0, 40);
    if (!this.user) await this.init();
    if (!this.user) return;
    const {
      error
    } = await this.client
      .from('profiles')
      .update({
        username: name
      })
      .eq('user_id', this.user.id);
    if (error) console.error("Error updating nickname:", error.message);
  }
  
  async getHybridLeaderboard(limit = 10, neighbors = 3) {
    return this.getLeaderboard(limit, neighbors);
  }
  
  async getLeaderboard(topLimit = 10, neighborBuffer = 3) {
    if (!this.client) return [];
    let myRank = null;
    // 1. Get the current user's rank
    if (this.user) {
      const {
        data: me
      } = await this.client
        .from('leaderboard_with_ranks')
        .select('rank')
        .eq('user_id', this.user.id)
        .maybeSingle();
      if (me) myRank = me.rank;
    }
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
    const {
      data,
      error
    } = await query.order('rank', {
      ascending: true
    });
    if (error) {
      console.error("Error fetching hybrid leaderboard:", error.message);
      return [];
    }
    return data;
  }

  async signInWithGoogle() {
    const {
      data,
      error
    } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Where to redirect after successful login
        redirectTo: window.location.origin
      }
    });
    if (error) console.error("Login error:", error.message);
  }

// --- Deck Methods ---

  /**
   * Saves or updates a deck.
   * @param {Object} deck - {id, title, words: []}
   */
  async saveDeck(deck) {
    if (!this.user) await this.init();
    if (!this.user) return;
    const { data, error } = await this.client
      .from('decks')
      .upsert({
        id: deck.id,
        user_id: this.user.id,
        title: deck.title,
        words: deck.words,
        count: deck.words.length,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) console.error("Save error:", error.message);
    return { data, error };
  }

  /**
   * Fetches all decks for the current user.
   */
  async getDecks() {
    if (!this.user) await this.init();
    if (!this.user) return [];

    const { data, error } = await this.client
      .from('decks')
      .select('*')
      .eq('user_id', this.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Fetch error:", error.message);
      return [];
    }
    return data;
  }

  async getDeck(id) {
    if (!this.user) await this.init();
    if (!this.user) return {};

    const { data, error } = await this.client
      .from('decks')
      .select("*")  //(`*, profiles!user_id(username)`)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error("Fetch error:", error.message);
      return {};
    }
    if (!data) return {};
    //data.username = (data.profile ? data.profile.username : null) || this.defaultUsername();
    return data;
  }

  /**
   * Deletes a deck by id.
   */
  async deleteDeck(id) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };

    const { error } = await this.client
      .from('decks')
      .delete()
      .eq('id', id)
      .eq('user_id', this.user.id);

    if (error) console.error("Delete error:", error.message);
    return { error };
  }
  
// end of class
}
