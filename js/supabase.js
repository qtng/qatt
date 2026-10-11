/*
Supabase connector for app.html,
provides authentication and
access to leaderboard.

const s = new SupabaseService();
await s.saveScore(username, score, sunflowers);
await s.getLeaderboard(topLimit = 20, neighborBuffer = 5);
await s.getDisplayName();         // the name in the leaderboard (null if there is none yet)
await s.setDisplayName(name);     // { name } or { error } (error.code 'name_taken', 'name_invalid'); names are unique, ignoring case
await s.getProfile();            // { name, score } of the user (name null if there is none yet)
await s.getProgress();            // { rows: [{ key, correct, wrong }] } of the practice, kept on the server (db/practice_progress.sql)
await s.recordAnswer(key, true);  // counts an answer on the server, gives { data: { correct, wrong, score } }
await s.importProgress(stats);    // once: takes over the progress of the browser
s.suggestedName();                // a first suggestion from the account (first name or the part of the email before the @)
await s.signInWithGoogle();
await s.signInWithEmail(email);   // sends a link
await s.signOut();
s.isAnonymous                     // true until the user has signed in (see js/login.js for the dialog)

Everybody starts as an anonymous user (their decks and score belong to it). Signing in with Google or an email
link turns this user into a permanent one with the same id, so nothing is lost. If the account exists already
(another device), the user signs in to it instead; the anonymous data of this browser then stays behind.
*/
class SupabaseService {
  
  constructor() {
    this.url = 'https://fteusrnytslaylfgemye.supabase.co';
    this.key = 'sb_publishable_2meEMOnLkAPYby7xd7Uy_w_kmHQw7dq';
    this.client = null;
    this.user = null;
  }
  
  // An error of the sign-in in the address after the return from Google (in the query or after the #): { code, description } or null
  _signInReturnError() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') + '&' + window.location.search.replace(/^\?/, ''));
    const code = params.get('error_code') || '', description = params.get('error_description') || params.get('error') || '';
    return code || description ? { code, description } : null;
  }

  async init() {
    if (typeof supabase === 'undefined') return;
    const returned = this._signInReturnError(); // read before the client works on the address
    this.client = supabase.createClient(this.url, this.key, {
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      }
    });
    if (returned) {
      this.authError = returned.description || returned.code;
      const url = new URL(window.location.href);
      ['error', 'error_code', 'error_description'].forEach(name => url.searchParams.delete(name));
      window.history.replaceState(null, '', url.pathname + url.search);
      // "Identity is already linked to another user": this Google account has a user already (the account from before),
      // so linking it to the anonymous user is not possible. Sign in to that user instead, once.
      const taken = returned.code == 'identity_already_exists' || /already linked/i.test(returned.description);
      if (taken && !sessionStorage.getItem('qatt_google_retry')) {
        sessionStorage.setItem('qatt_google_retry', '1');
        this.authError = null;
        await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this._returnUrl() } });
        await new Promise(resolve => setTimeout(resolve, 8000)); // the browser is on its way to Google
      }
    }
    // Check for existing session in localStorage
    const {
      data: {
        session
      }
    } = await this.client.auth.getSession();
    if (session) {
      this.user = session.user;
      if (!this.isAnonymous) sessionStorage.removeItem('qatt_google_retry');
    } else {
      await this._authenticate();
    }
    this.client.auth.onAuthStateChange((event, session) => {
      if (session && session.user) this.user = session.user;
    });
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
  
  // --- display name in the leaderboard (profiles.username, unique ignoring case: see the index profiles_username_lower_key) ---

  // Letters of every script (also Han: Chinese, Nôm, Japanese, Korean), digits, hyphen, underscore and single spaces,
  // up to 40 characters (counted by character, not by UTF-16 unit, so rare Han characters are not cut in the middle).
  static cleanName(name) {
    return Array.from(String(name || '')
      .replace(/[^\p{L}\p{N}\-_\s]/ug, '')
      .replace(/\s+/g, ' ')
      .trim())
      .slice(0, 40)
      .join('')
      .trim();
  }

  static nameError(name) {
    if (!name) return 'Please enter a name (letters or digits).';
    if (name.toLowerCase() == 'anonymous') return 'Please choose another name.';
    return null;
  }

  // name (null if there is none yet) and score of the user
  async getProfile() {
    if (!this.client || !this.user) return null;
    const { data, error } = await this.client.from('profiles').select('username, score').eq('user_id', this.user.id).maybeSingle();
    if (error) return null;
    const name = data && data.username;
    return { name: name && name != 'Anonymous' ? name : null, score: (data && data.score) || 0 };
  }

  // the name of the user in the leaderboard, null if there is none yet
  async getDisplayName() {
    const profile = await this.getProfile();
    return profile ? profile.name : null;
  }

  // --- practice: progress and score are kept on the server, see db/practice_progress.sql ---

  // all words of the user with their counts: { rows: [{ key, correct, wrong }] } or { error }
  async getProgress() {
    if (!this.client || !this.user) return { error: new Error('Not available right now.') };
    const rows = [];
    for (let from = 0; ; from += 1000) { // the server gives 1000 rows at most
      const { data, error } = await this.client.from('practice_progress').select('key, correct, wrong').order('key').range(from, from + 999);
      if (error) return { error };
      rows.push(...data);
      if (data.length < 1000) return { rows };
    }
  }

  // counts one answer on the server (and changes the score there): { data: { correct, wrong, score } } or { error }
  async recordAnswer(key, correct) {
    if (!this.client || !this.user) return { error: new Error('Not available right now.') };
    const { data, error } = await this.client.rpc('practice_answer', { p_key: key, p_correct: !!correct });
    return error ? { error } : { data };
  }

  // takes over the progress that was kept in the browser, once per account: { data: { imported } } or { error }
  async importProgress(stats) {
    if (!this.client || !this.user) return { error: new Error('Not available right now.') };
    const { data, error } = await this.client.rpc('practice_import', { p_stats: stats });
    return error ? { error } : { data };
  }

  // a first suggestion for the name: the first name of the account or the part of the email before the @
  suggestedName() {
    const user = this.user || {}, meta = user.user_metadata || {};
    const raw = meta.given_name || meta.name || meta.full_name || (user.email || '').split('@')[0] || '';
    return SupabaseService.cleanName(String(raw).split(/\s+/)[0]);
  }

  async isNameTaken(name) {
    // ilike without its wildcards: % and _ and \ in the name are escaped
    const pattern = name.replace(/[\\%_]/g, '\\$&');
    const { data } = await this.client.from('profiles').select('user_id').ilike('username', pattern).neq('user_id', this.user.id).limit(1);
    return !!(data && data.length);
  }

  // Sets the name, also when the user has no profile yet (the score stays as it is). Gives { name } or { error }.
  async setDisplayName(name) {
    name = SupabaseService.cleanName(name);
    const invalid = SupabaseService.nameError(name);
    if (invalid) return { error: { code: 'name_invalid', message: invalid } };
    if (!this.user) await this.init();
    if (!this.user) return { error: { code: 'no_user', message: 'Not available right now.' } };
    const taken = { code: 'name_taken', message: 'This name is taken, please choose another one.' };
    if (await this.isNameTaken(name)) return { error: taken };
    const { error } = await this.client.from('profiles').upsert(
      { user_id: this.user.id, username: name, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return { error: error.code == '23505' ? taken : error };
    return { name };
  }

  async setNickname(name) {
    return this.setDisplayName(name);
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

  get isAnonymous() {
    return !!this.user && this.user.is_anonymous !== false;
  }

  // the page the user returns to after the login (the link in the email, the way back from Google)
  _returnUrl() {
    return window.location.origin + window.location.pathname + window.location.search;
  }

  async signInWithGoogle() {
    if (!this.client) return { error: new Error('Supabase is not available') };
    const redirectTo = this._returnUrl();
    if (this.isAnonymous) {
      // keeps the user id, so the decks and the score stay with the account
      const { error } = await this.client.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      if (!error) return {};
      if (error.code !== 'identity_already_exists') {
        console.error("Login error:", error.message);
        return { error };
      }
      // this Google account belongs to another user already: sign in to it
    }
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) console.error("Login error:", error.message);
    return error ? { error } : {};
  }

  // Sends a link by email. An anonymous user gets the email address (and keeps the id once the link is opened);
  // an address that exists already gets a link to sign in.
  async signInWithEmail(email) {
    if (!this.client) return { error: new Error('Supabase is not available') };
    email = (email || '').trim();
    const redirectTo = this._returnUrl();
    if (this.isAnonymous) {
      const { error } = await this.client.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
      if (!error) return { sent: true };
      if (error.code !== 'email_exists') return { error };
    }
    const { error } = await this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    return error ? { error } : { sent: true };
  }

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.user = null;
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
      .select('id, user_id, title, count, is_public')
      .eq('user_id', this.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Fetch error:", error.message);
      return [];
    }
    return data;
  }

  /**
   * Ids of the user's decks that contain the character `nom` (words are {n, qn}).
   * The server filters (jsonb containment), so no words are transferred; if that is not possible, the words are filtered here.
   */
  async getDeckIdsWithWord(nom) {
    if (!this.user) await this.init();
    if (!this.user) return [];
    const own = () => this.client.from('decks').select('id').eq('user_id', this.user.id);
    let { data, error } = await own().contains('words', [{ n: nom }]);
    if (error) {
      const all = await this.client.from('decks').select('id, words').eq('user_id', this.user.id);
      if (all.error) return [];
      data = all.data.filter(d => (d.words || []).some(w => w.n === nom));
    }
    return data.map(d => d.id);
  }

  /**
   * Adds the word {n, qn} to the deck, or removes the word with n when `present` is false. Only this one deck is loaded.
   */
  async setWordInDeck(deckId, word, present) {
    const deck = await this.getDeck(deckId);
    if (!deck.id || deck.user_id !== (this.user && this.user.id)) return { error: 'Deck not found' };
    const words = (deck.words || []).filter(w => w.n !== word.n);
    if (present) words.push(word);
    return this.saveDeck({ id: deck.id, title: deck.title, words });
  }

  async getPublicDecks() {
    if (!this.client) await this.init();

    const { data, error } = await this.client
      .from('decks')
      .select('*')
      .eq('is_public', true)
      .order('title', { ascending: true });

    if (error) {
      console.error("Fetch error:", error.message);
      return [];
    }
    return data;
  }

  async getDeck(id) {
    if (!this.client) await this.init();

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

// --- Forum Methods ---

  /**
   * Creates a new forum topic.
   */
  async saveTopic(topic) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };
    const { data, error } = await this.client
      .from('forum_topics')
      .insert([{
        title: topic.title,
        content: topic.content
      }]);
    if (error) console.error("Save topic error:", error.message);
    return { data, error };
  }

  /**
   * Saves a comment or a reply.
   */
  async saveComment(comment) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };
    const { data, error } = await this.client
      .from('forum_comments')
      .insert([{
        topic_id: comment.topicId,
        parent_id: comment.parentId || null,
        text: comment.text
      }]);
    if (error) console.error("Save comment error:", error.message);
    return { data, error };
  }

  /**
   * Fetches topics joined with user profiles and their comments.
   */
  async getTopics() {
    if (!this.client) await this.init();
    // author:profiles!author_id(username) joins the profiles table using our author_id column
    const { data, error } = await this.client
      .from('forum_topics')
      .select(`
        *,
        author:profiles!author_id(username),
        comments:forum_comments(
          *,
          author:profiles!author_id(username)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch topics error:", error.message);
      return [];
    }
    return data;
  }

  // --- Slide Methods ---

  async getSlides(group = "", includePrivate = false) {
    if (!this.client) await this.init();

    let query = this.client.from('slides').select('*');
    if (group) query = query.eq('group', group);
    if (!includePrivate) query = query.eq('is_public', true);

    const { data, error } = await query.order('order', { ascending: true });
    if (error) {
      console.error("Fetch slides error:", error.message);
      return [];
    }
    return data;
  }
  

  // Create a new slide
  async createSlide(group, slideData = {}) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };
    if (!group) return { error: "Group is required" };

    const { data, error } = await this.client
      .from('slides')
      .insert([{
        group: group,
        title: slideData.title || null,
        order: slideData.order || 0,
        content: slideData.content || "",
        english: slideData.english || "",
        classes: slideData.classes || ""
      }])
      .select(); 

    if (error) console.error("Create slide error:", error.message);
    return { data, error };
  }

  // Update an existing slide
  async setSlide(id, slideData = {}) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };
    if (!id) return { error: "ID is required" };

    const updateData = {};
    if (slideData.group !== undefined) updateData.group = slideData.group;
    if (slideData.title !== undefined) updateData.title = slideData.title;
    if (slideData.order !== undefined) updateData.order = slideData.order;
    if (slideData.content !== undefined) updateData.content = slideData.content;
    if (slideData.english !== undefined) updateData.english = slideData.english;
    if (slideData.classes !== undefined) updateData.classes = slideData.classes;
    const { data, error } = await this.client
      .from('slides')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) console.error("Set slide error:", error.message);
    return { data, error };
  }

  // Delete a slide
  async deleteSlide(id) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };
    if (!id) return { error: "ID is required" };

    const { error } = await this.client
      .from('slides')
      .delete()
      .eq('id', id);

    if (error) console.error("Delete slide error:", error.message);
    return { error };
  }

  // --- Reading Methods ---
  
  async addReading(symbol, ids, reading, source) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };

    const parsedSymbol = symbol ? String(symbol).substring(0, 3) : null;
    const { error: deleteError } = await this.client
      .from('readings')
      .delete()
      .eq('symbol', parsedSymbol)
      .eq('ids', ids)
      .eq('reading', reading)
      .eq('deleted', true)
      .eq('user_id', this.user.id); // <- WICHTIG: Erlaubt nur das Löschen eigener Marker

    if (deleteError) {
      console.error("Soft-delete error", deleteError.message);
    }
    const { data, error } = await this.client
      .from('readings')
      .insert([{
        user_id: this.user.id,
        symbol: parsedSymbol,
        ids: ids,
        reading: reading,
        source: source
      }])
      .select();

    if (error) console.error("Add reading error:", error.message);
    return { data, error };
  }

  async deleteReading(symbol, ids, reading, source) {
    if (!this.user) await this.init();
    if (!this.user) return { error: "Auth required" };

    // Statt "DELETE" machen wir einen "INSERT" des Tombstones
    const { data, error } = await this.client
    .from('readings')
    .insert([{
      user_id: this.user.id,
      symbol: symbol ? String(symbol).substring(0, 3) : null,
      ids: ids,
      reading: reading,
      source: source,
      deleted: true 
    }])
    .select();

    if (error) console.error("Delete/Hide reading error:", error.message);
    return { data, error };
  }

  async getReadings(own = true) {
    if (!this.client) await this.init();

    let query = this.client.from('readings').select('*');

    if (own) {
      if (!this.user) return [];
      query = query.eq('user_id', this.user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get readings error:", error.message);
      return [];
    }
    return data;
  }


// end of class
}
