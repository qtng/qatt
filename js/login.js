/*
Login dialog and account line for the pages that use SupabaseService (js/supabase.js).

await QattLogin.require(db, 'Sign in to create decks.')   // true if signed in; else opens the dialog and gives false
QattLogin.status(db, element, hint, hintVi)               // "Signed in as …" with a sign-out link, or "Not signed in." and the hint with a sign-in link. The hint replaces the general one ("Sign in to keep your work on every device."); the words of the link are in [ ], e.g. '[Sign in] to use the translator.' and hintVi '[Đăng nhập] để dùng công cụ dịch.' (without [ ] the whole hint is the link; without hintVi the hint stays English)
QattLogin.t(en, vi)                                       // the text in the language of the page (Lang of navigation.js), English where Lang is not loaded
// Every text is English and Vietnamese (the Vietnamese ones were written by Claude: drafts). A message of QattLogin.open can be a text or { en, vi }. The account line follows a switch of the language.
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
.qatt-login input[type=email], .qatt-login input[type=text] { display: block; width: 100%; box-sizing: border-box; border: 1px solid #cdbf9f; border-radius: .7rem; padding: .5rem .8rem; margin-bottom: .6rem; font-size: 1rem; font-family: inherit; background: #fff; color: #2b2118 }
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
			const google = el('button', { type: 'button', className: 'google', textContent: T('Continue with Google', 'Tiếp tục với Google') });
			const email = el('input', { type: 'email', placeholder: T('Email address', 'Địa chỉ email'), autocomplete: 'email', required: true });
			const send = el('button', { type: 'submit', className: 'main', textContent: T('Send me a link', 'Gửi liên kết cho tôi') });
			const form = el('form', { method: 'dialog' },
				el('h2', { textContent: T('Sign in', 'Đăng nhập') }),
				el('p', { textContent: pick(message) || T('Sign in to keep your work on every device. What you have so far stays with your account.', 'Đăng nhập để lưu công việc của bạn trên mọi thiết bị. Những gì bạn đã có sẽ được giữ trong tài khoản của bạn.') }),
				google,
				el('div', { className: 'or', textContent: T('or', 'hoặc') }),
				email, send, note);
			const close = el('button', { type: 'button', className: 'qatt-login-close', textContent: '×', title: T('Close', 'Đóng') });
			close.setAttribute('aria-label', T('Close', 'Đóng'));
			dialog.append(close, form);
			document.body.append(dialog);

			const busy = on => { google.disabled = send.disabled = on; };
			google.addEventListener('click', async () => {
				busy(true);
				show('');
				const { error } = await db.signInWithGoogle();
				if (error) { show(T('Could not start the sign-in: ', 'Không thể bắt đầu đăng nhập: ') + error.message, true); busy(false); }
			});
			form.addEventListener('submit', async e => {
				e.preventDefault();
				if (!email.value.trim()) return;
				busy(true);
				show('');
				const { error, sent } = await db.signInWithEmail(email.value);
				if (error) {
					// too many mails sent (the mail service of the project has a small limit for everybody together): say what to do instead of "rate limit exceeded"
					const limited = error.code === 'over_email_send_rate_limit' || error.status === 429 || /rate limit/i.test(error.message || '');
					show(limited
						? T('We cannot send sign-in links right now because too many were requested. Please try again in about an hour, or tap "Continue with Google" above.', 'Hiện chưa thể gửi liên kết đăng nhập vì có quá nhiều yêu cầu. Vui lòng thử lại sau khoảng một giờ, hoặc bấm "Tiếp tục với Google" ở trên.')
						: T('Could not send the link: ', 'Không thể gửi liên kết: ') + error.message, true);
					busy(false); return;
				}
				if (sent) { show(T(`We sent a link to ${email.value.trim()}. Open it on this device to finish.`, `Chúng tôi đã gửi liên kết tới ${email.value.trim()}. Hãy mở nó trên thiết bị này để hoàn tất.`)); send.textContent = T('Link sent', 'Đã gửi liên kết'); }
			});
			close.addEventListener('click', () => dialog.close());
			dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
			dialog.addEventListener('close', () => { dialog.remove(); resolve(signedIn(db)); });
			dialog.showModal();
			google.focus();   // not the e-mail field: on a phone it would open the keyboard at once; most people should use the Google button
		});
	}

	// Dialog for the display name (unique, checked by db.setDisplayName). required: no way to close it without a name.
	function chooseName(db, { required = false, current = '' } = {}) {
		addStyle();
		return new Promise(resolve => {
			let chosen = null;
			const dialog = el('dialog', { className: 'qatt-login' });
			const note = el('p', { className: 'note', hidden: true });
			const input = el('input', { type: 'text', value: current || db.suggestedName(), autocomplete: 'nickname', required: true });
			input.setAttribute('aria-label', T('Name', 'Tên'));
			const save = el('button', { type: 'submit', className: 'main', textContent: T('Save', 'Lưu') });
			const form = el('form', { method: 'dialog' },
				el('h2', { textContent: required ? T('What should we call you?', 'Chúng tôi nên gọi bạn là gì?') : T('Your name', 'Tên của bạn') }),
				input, save, note);
			dialog.append(form);
			if (!required) {
				const close = el('button', { type: 'button', className: 'qatt-login-close', textContent: '×', title: T('Close', 'Đóng') });
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

	// the text in the language of the page; without Lang (navigation.js) English
	const T = (en, vi) => (window.Lang && typeof Lang.t === 'function' ? Lang.t(en, vi) : en);
	// a message or hint of a page: a text, or { en, vi }
	const pick = x => (x && typeof x === 'object' ? T(x.en, x.vi) : x);

	// the hint of the account line when the page gives none; the words of the link are in [ ]
	const KEEP_HINT = { en: '[Sign in] to keep your work on every device.', vi: '[Đăng nhập] để lưu công việc của bạn trên mọi thiết bị.' };

	const accountLines = new Set();   // the lines that follow a change of the language
	function status(db, element, hint, hintVi) {
		addStyle();
		element.classList.add('qatt-account');
		accountLines.add({ db, element, hint, hintVi });
		renderStatus(db, element, hint, hintVi);
	}
	// the text of the hint with the words in [ ] as the link; without [ ] the whole text is the link
	function linkText(text, onClick) {
		const m = /\[([^\]]+)\]/.exec(text);
		const link = el('a', { textContent: m ? m[1] : text });
		link.addEventListener('click', onClick);
		return m ? [text.slice(0, m.index), link, text.slice(m.index + m[0].length)] : [link];
	}
	function renderStatus(db, element, hint, hintVi) {
		element.replaceChildren();
		if (!db) return;   // without a login there is no user (nobody is signed in anonymously any more): the line then offers the sign-in
		if (signedIn(db)) {
			const out = el('a', { textContent: T('Sign out', 'Đăng xuất') });
			out.addEventListener('click', async () => { await db.signOut(); location.reload(); });
			element.append(`${T('Signed in as', 'Đã đăng nhập:')} ${db.user.email || T('you', 'bạn')} · `, out);
		} else {
			const text = hint ? T(hint, hintVi || hint) : T(KEEP_HINT.en, KEEP_HINT.vi);
			element.append(T('Not signed in.', 'Chưa đăng nhập.') + ' ', ...linkText(text, () => open(db)));
		}
	}
	document.addEventListener('langchange', () => accountLines.forEach(l => { if (l.element.isConnected) renderStatus(l.db, l.element, l.hint, l.hintVi); else accountLines.delete(l); }));

	window.QattLogin = { open, require, status, chooseName, t: T };
})();
