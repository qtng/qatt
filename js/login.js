/*
Login dialog and account line for the pages that use SupabaseService (js/supabase.js).

await QattLogin.require(db, 'Sign in to create decks.')   // true if signed in; else opens the dialog and gives false
QattLogin.status(db, element)                             // "Signed in as …" with a sign-out link, or a sign-in link
QattLogin.open(db, message)                               // the dialog
await QattLogin.chooseName(db, { required, current })     // the name for the leaderboard: the new name, null if the dialog was closed
*/
(() => {
	const STYLE = `
dialog.qatt-login { border: 1px solid #e4d9c0; border-radius: 1rem; padding: 0; width: min(24rem, calc(100vw - 2rem)); color: #2b2118; background: #fffdf8;
	box-shadow: 0 1rem 3rem rgba(60, 40, 20, .3); font-family: system-ui, -apple-system, sans-serif }
dialog.qatt-login::backdrop { background: rgba(43, 33, 24, .45) }
.qatt-login form { margin: 0; padding: 1.2rem 1.3rem 1.3rem }
.qatt-login h2 { font: 400 1.4rem Georgia, "Times New Roman", serif; margin: 0 0 .4rem }
.qatt-login p { margin: 0 0 1rem; color: #5b4d3d; font-size: .92rem }
.qatt-login .qatt-login-close { position: absolute; top: .5rem; right: .7rem; border: 0; background: none; font-size: 1.5rem; line-height: 1; color: #7b6c58; cursor: pointer }
.qatt-login button.main, .qatt-login button.google { display: block; width: 100%; border-radius: 2rem; padding: .55rem 1rem; font-size: .95rem; cursor: pointer }
.qatt-login button.google { border: 1px solid #cdbf9f; background: #fff; color: #2b2118 }
.qatt-login button.google:hover { background: #f1e8d2 }
.qatt-login button.main { border: 1px solid #a8362a; background: #a8362a; color: #fff }
.qatt-login button.main:hover { background: #8c2c22 }
.qatt-login button:disabled { opacity: .6; cursor: default }
.qatt-login .or { display: flex; align-items: center; gap: .7rem; margin: .9rem 0; color: #a8977e; font-size: .78rem; text-transform: uppercase; letter-spacing: .15em }
.qatt-login .or::before, .qatt-login .or::after { content: ""; flex: 1; border-top: 1px solid #e4d9c0 }
.qatt-login input[type=email], .qatt-login input[type=text] { display: block; width: 100%; box-sizing: border-box; border: 1px solid #cdbf9f; border-radius: .7rem; padding: .5rem .8rem; margin-bottom: .6rem; font-size: 1rem; background: #fff; color: #2b2118 }
.qatt-login input[type=email]:focus, .qatt-login input[type=text]:focus { outline: 0; border-color: #a8362a; box-shadow: 0 0 0 .2rem rgba(168, 54, 42, .15) }
.qatt-login .note { margin: .8rem 0 0; font-size: .85rem; color: #5b4d3d }
.qatt-login .note.error { color: #a8362a }
.qatt-account { font-size: .85rem; color: #7b6c58 }
.qatt-account a { color: #a8362a; cursor: pointer; text-decoration: none }
.qatt-account a:hover { text-decoration: underline }`;

	function addStyle() {
		if (document.getElementById('qatt-login-style')) return;
		const style = document.createElement('style');
		style.id = 'qatt-login-style';
		style.textContent = STYLE;
		document.head.append(style);
	}

	const signedIn = db => !!db && !!db.user && !db.isAnonymous;

	function el(tag, props = {}, ...children) {
		const node = Object.assign(document.createElement(tag), props);
		node.append(...children);
		return node;
	}

	// resolves when the dialog is closed; signing in with Google leaves the page, an email link is opened later
	function open(db, message) {
		addStyle();
		return new Promise(resolve => {
			const dialog = el('dialog', { className: 'qatt-login' });
			const note = el('p', { className: 'note', hidden: true });
			const show = (text, error) => { note.textContent = text; note.className = 'note' + (error ? ' error' : ''); note.hidden = !text; };
			const google = el('button', { type: 'button', className: 'google', textContent: 'Continue with Google' });
			const email = el('input', { type: 'email', placeholder: 'Email address', autocomplete: 'email', required: true });
			const send = el('button', { type: 'submit', className: 'main', textContent: 'Send me a link' });
			const form = el('form', { method: 'dialog' },
				el('h2', { textContent: 'Sign in' }),
				el('p', { textContent: message || 'Sign in to keep your decks on every device. What you have so far stays with your account.' }),
				google,
				el('div', { className: 'or', textContent: 'or' }),
				email, send, note);
			const close = el('button', { type: 'button', className: 'qatt-login-close', textContent: '×', title: 'Close' });
			close.setAttribute('aria-label', 'Close');
			dialog.append(close, form);
			document.body.append(dialog);

			const busy = on => { google.disabled = send.disabled = on; };
			google.addEventListener('click', async () => {
				busy(true);
				show('');
				const { error } = await db.signInWithGoogle();
				if (error) { show('Could not start the sign-in: ' + error.message, true); busy(false); }
			});
			form.addEventListener('submit', async e => {
				e.preventDefault();
				if (!email.value.trim()) return;
				busy(true);
				show('');
				const { error, sent } = await db.signInWithEmail(email.value);
				if (error) { show('Could not send the link: ' + error.message, true); busy(false); return; }
				if (sent) { show(`We sent a link to ${email.value.trim()}. Open it on this device to finish.`); send.textContent = 'Link sent'; }
			});
			close.addEventListener('click', () => dialog.close());
			dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
			dialog.addEventListener('close', () => { dialog.remove(); resolve(signedIn(db)); });
			dialog.showModal();
			email.focus();
		});
	}

	// Dialog for the display name (unique, checked by db.setDisplayName). required: no way to close it without a name.
	function chooseName(db, { required = false, current = '' } = {}) {
		addStyle();
		return new Promise(resolve => {
			let chosen = null;
			const dialog = el('dialog', { className: 'qatt-login' });
			const note = el('p', { className: 'note', hidden: true });
			const input = el('input', { type: 'text', value: current || db.suggestedName(), maxLength: 40, autocomplete: 'nickname', required: true });
			input.setAttribute('aria-label', 'Name');
			const save = el('button', { type: 'submit', className: 'main', textContent: 'Save' });
			const form = el('form', { method: 'dialog' },
				el('h2', { textContent: required ? 'Your name' : 'Change your name' }),
				el('p', { textContent: 'This name appears in the leaderboard, so you do not have to use your real name. Letters, digits, - and _, 2 to 40 characters; every name exists once.' }),
				input, save, note);
			dialog.append(form);
			if (!required) {
				const close = el('button', { type: 'button', className: 'qatt-login-close', textContent: '×', title: 'Close' });
				close.addEventListener('click', () => dialog.close());
				dialog.prepend(close);
			} else {
				dialog.addEventListener('cancel', e => e.preventDefault()); // Esc does not close it
			}
			document.body.append(dialog);

			form.addEventListener('submit', async e => {
				e.preventDefault();
				save.disabled = true;
				note.hidden = true;
				const { name, error } = await db.setDisplayName(input.value);
				if (error) {
					note.textContent = error.message;
					note.className = 'note error';
					note.hidden = false;
					save.disabled = false;
					input.focus();
					return;
				}
				chosen = name;
				dialog.close();
			});
			dialog.addEventListener('close', () => { dialog.remove(); resolve(chosen); });
			dialog.showModal();
			input.focus();
			input.select();
		});
	}

	// true if the user is signed in; otherwise the dialog opens and the answer is false (sign-in reloads the page)
	async function require(db, message) {
		if (signedIn(db)) return true;
		await open(db, message);
		return false;
	}

	function status(db, element) {
		addStyle();
		element.classList.add('qatt-account');
		element.replaceChildren();
		if (!db || !db.user) return;
		if (signedIn(db)) {
			const out = el('a', { textContent: 'Sign out' });
			out.addEventListener('click', async () => { await db.signOut(); location.reload(); });
			element.append(`Signed in as ${db.user.email || 'you'} · `, out);
		} else {
			const inn = el('a', { textContent: 'Sign in' });
			inn.addEventListener('click', () => open(db));
			element.append('Not signed in. ', inn, ' to keep your decks on every device.');
		}
	}

	window.QattLogin = { open, require, status, chooseName };
})();
