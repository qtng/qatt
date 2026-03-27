/**
 * global-nav.js (v2 mit Auto-Active-Detection)
 */
(function() {
    const navConfig = {
        title: "QATT",
        links: [
            { name: "Tutorial", url: "tutorial.html" },
            { name: "Wikipedia Browser", url: "wiki.html" },
            { name: "Logo Creator", url: "logo-creator.html" },
        ]
    };

    function injectNav() {
        const currentPath = window.location.pathname;
        const nav = document.createElement('nav');
        nav.className = "navbar navbar-expand-lg navbar-dark bg-dark fixed-top shadow-sm";
        
        // Dynamische Link-Generierung mit Active-Check
        const navLinks = navConfig.links.map(link => {
            // Prüft, ob der aktuelle Pfad mit der URL übereinstimmt
            const isActive = currentPath === link.url || (link.url !== "/" && currentPath.startsWith(link.url));
            const activeClass = isActive ? "active" : "";
            const ariaCurrent = isActive ? 'aria-current="page"' : "";

            return `
                <li class="nav-item">
                    <a class="nav-link ${activeClass}" href="${link.url}" ${ariaCurrent}>
                        ${link.name}
                    </a>
                </li>
            `;
        }).join('');

        nav.innerHTML = `
            <div class="container-fluid">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <span class="fw-bold">${navConfig.title}</span>
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        ${navLinks}
                    </ul>
                </div>
            </div>
        `;

        // Layout-Korrektur
        document.body.style.paddingTop = "70px"; 
        document.body.prepend(nav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNav);
    } else {
        injectNav();
    }
})();
