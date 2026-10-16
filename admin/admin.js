/*
The admin area. Who is an admin is a claim of the login token (app_metadata.is_admin, set on the server, see db/admin_stats.sql), so the
page needs no query for it. This only decides what the page shows: the real check is in the database (admin_stats() refuses everybody else).

await Admin.check(db)   // 'admin', 'signin' (not signed in) or 'denied' (signed in, no admin); a token from before the flag was set is renewed once
*/
window.Admin = {
	isAdmin(user) {
		return !!user && user.is_anonymous === false && !!user.app_metadata && user.app_metadata.is_admin === true;
	},
	async check(db) {
		if (!db.user || db.isAnonymous) return 'signin';
		if (this.isAdmin(db.user)) return 'admin';
		try {
			const { data } = await db.client.auth.refreshSession();
			if (this.isAdmin(data && data.session && data.session.user)) return 'admin';
		} catch (e) { /* no network: stays denied */ }
		return 'denied';
	}
};
