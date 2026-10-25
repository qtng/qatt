/*
The admin area. Who is an admin is a claim of the login token (app_metadata.is_admin, set on the server, see tools/db/admin_stats.sql), so the
page needs no query for it. This only decides what the page shows: the real check is in the database (admin_stats() refuses everybody else).

await Admin.owner(db)   // true for an admin with app_metadata.is_owner (the private pages); a token from before the flag is renewed once
await Admin.check(db)   // 'admin', 'signin' (not signed in) or 'denied' (signed in, no admin); a token from before the flag was set is renewed once.
                        // For an admin it also sets localStorage.qv_off = '1' (the visit counter then leaves this browser out).
*/
window.Admin = {
	// the visit counter (js/navigation.js) leaves this browser out from now on, also when the admin is not signed in: remove it with localStorage.removeItem("qv_off")
	leaveOut(result) {
		try { localStorage.setItem('qv_off', '1'); } catch (e) { /* no storage */ }
		return result;
	},
	isAdmin(user) {
		return !!user && user.is_anonymous === false && !!user.app_metadata && user.app_metadata.is_admin === true;
	},
	// the owner flag (app_metadata.is_owner) opens the private pages (private_file() in the database checks it); an admin without it sees the rest of the admin area
	isOwner(user) {
		return this.isAdmin(user) && user.app_metadata.is_owner === true;
	},
	async owner(db) {
		if (this.isOwner(db.user)) return true;
		try {
			const { data } = await db.client.auth.refreshSession();
			return this.isOwner(data && data.session && data.session.user);
		} catch (e) { return false; }
	},
	async check(db) {
		if (!db.user || db.isAnonymous) return 'signin';
		if (this.isAdmin(db.user)) return this.leaveOut('admin');
		try {
			const { data } = await db.client.auth.refreshSession();
			if (this.isAdmin(data && data.session && data.session.user)) return this.leaveOut('admin');
		} catch (e) { /* no network: stays denied */ }
		return 'denied';
	}
};
