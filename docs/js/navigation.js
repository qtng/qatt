/**
 * Chunom.org Navigation Script v2
 * Injects a grouped, mobile-friendly Offcanvas navigation.
 */
(function() {
    const navConfig = {
        title: "Chunom.org",
        sections: [
            {
                header: "Chữ Nôm",
                links: [
                    { name: "Online Dictionary", url: "/chunom", icon: "bi-book" },
                    { name: "Nôm Writer (IME)", url: "/chunom/ime.html", icon: "bi-pencil-square" },
                    //{ name: "Historical Scans", url: "/chunom/scans.html", icon: "bi-archive" }
                ]
            },
            {
                header: "Quốc Âm Tân Tự",
                links: [
                    { name: "QATT App", url: "/qatt-dc/app.html", icon: "bi-mortarboard" },
                    { name: "Logo Creator", url: "/qatt-dc/logo-creator.html", icon: "bi-palette" },
                    { name: "QATT Wiki", url: "/qatt-dc/wiki.html", icon: "bi-info-circle" }
                ]
            }
        ]
    };

    function injectDependencies() {
        if (!document.querySelector('link[href*="bootstrap-icons"]')) {
            const icons = document.createElement('link');
            icons.rel = 'stylesheet';
            icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
            document.head.appendChild(icons);
        }

        const style = document.createElement('style');
        style.textContent = `
            .nav-section-header {
                font-size: 0.72rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05rem;
                color: #6c757d;
                padding: 1.25rem 1rem 0.5rem;
            }
            .offcanvas-nav-link {
                color: #dee2e6;
                padding: 0.7rem 1rem;
                display: flex;
                align-items: center;
                text-decoration: none;
                transition: background 0.2s;
            }
            .offcanvas-nav-link:hover, .offcanvas-nav-link.active {
                background-color: #2c3034;
                color: #fff;
            }
            .offcanvas-nav-link i {
                margin-right: 12px;
                width: 20px;
                text-align: center;
            }
            .navbar-brand .version-badge {
                font-size: 0.65rem;
                color: #ffc107;
                vertical-align: super;
            }
        `;
        document.head.appendChild(style);
    }

    function injectNav() {
        const currentPath = window.location.pathname;

        const header = document.createElement('nav');
        header.className = "navbar navbar-dark bg-dark fixed-top border-bottom border-secondary shadow-sm";
        header.style.backdropFilter = "blur(8px)";
        header.style.backgroundColor = "rgba(33, 37, 41, 0.9)";

        header.innerHTML = `
            <div class="container-fluid">
                <a class="navbar-brand fw-bold" href="/chunom">
                    ${navConfig.title}<span class="version-badge ms-1">v2</span>
                </a>
                <button class="navbar-toggler border-0" type="button" data-bs-toggle="offcanvas" data-bs-target="#qattOffcanvas">
                    <span class="navbar-toggler-icon"></span>
                </button>
            </div>
        `;

        const offcanvas = document.createElement('div');
        offcanvas.className = "offcanvas offcanvas-start bg-dark text-light";
        offcanvas.id = "qattOffcanvas";
        offcanvas.tabIndex = "-1";
        offcanvas.style.width = "280px";

        let sectionsHtml = navConfig.sections.map(section => {
            const linksHtml = section.links.map(link => {
                const isActive = currentPath.includes(link.url);
                return `
                    <a href="${link.url}" class="offcanvas-nav-link ${isActive ? 'active' : ''}">
                        <i class="bi ${link.icon}"></i> ${link.name}
                    </a>
                `;
            }).join('');

            return `
                <div class="nav-section-header">${section.header}</div>
                <div class="nav flex-column">${linksHtml}</div>
            `;
        }).join('');

        offcanvas.innerHTML = `
            <div class="offcanvas-header border-bottom border-secondary">
                <h5 class="offcanvas-title fw-bold">${navConfig.title}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
            </div>
            <div class="offcanvas-body p-0">
                ${sectionsHtml}
                <div class="mt-auto p-3 text-center">
                    <small class="text-muted">© 2026 Chunom.org</small>
                </div>
            </div>
        `;

        document.body.style.paddingTop = "60px";
        document.body.prepend(header);
        document.body.appendChild(offcanvas);
    }

    window.addEventListener("load", () => {
        injectDependencies();
        injectNav();
    });
})();

