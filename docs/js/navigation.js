(function() {
    const navConfig = {
        title: "Chunom.org",
        sections: [
            {
                header: "Chữ Nôm",
                themeClass: "text-warning",
                linkClass: "link-nom",
                links: [
                    { name: "Online Dictionary", url: "/chunom/", icon: "bi-book" },
                    { name: "Nôm Writer (IME)", url: "/chunom/ime.html", icon: "bi-pencil-square" },
                    { name: "Flashcards", url: "/chunom/flashcards.html", icon: "bi-layers-half" },
                ]
            },
            {
                header: "Quốc Âm Tân Tự (QATT)",
                themeClass: "text-info",
                linkClass: "link-qatt",
                links: [
                    { name: "Practise QATT", url: "/qatt-dc/app.html", icon: "bi-mortarboard" },
                    { name: "QATT Tutorial", url: "/qatt-dc/tutorial.html", icon: "bi-journal-text" },
                    { name: "QATT Logo Creator", url: "/qatt-dc/logo-creator.html", icon: "bi-palette" },
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

        if (typeof bootstrap === 'undefined' && !document.querySelector('script[src*="bootstrap"]')) {
            const bsScript = document.createElement('script');
            bsScript.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
            document.head.appendChild(bsScript);
        }

        const style = document.createElement('style');
        style.textContent = `
            .nav-backdrop{
              background: rgba(33, 37, 41, 0.7);
              backdrop-filter: blur(15px);
            }
            .navmenu-backdrop{
              background: rgba(33, 37, 41, 0.05);
              backdrop-filter: blur(10px);
            }
            .nav-section-header {
                font-size: 0.75rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.08rem;
                padding: 1.5rem 1.25rem 0.5rem;
            }
            .offcanvas-nav-link {
                color: #adb5bd;
                padding: 0.7rem 1.25rem;
                display: flex;
                align-items: center;
                text-decoration: none;
                transition: all 0.2s ease;
                border-left: 3px solid transparent;
            }
            .link-nom.active, .link-nom:hover {
                border-left-color: var(--bs-warning);
                background: linear-gradient(90deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0) 100%);
                color: #fff !important;
            }
            .link-qatt.active, .link-qatt:hover {
                border-left-color: var(--bs-info);
                background: linear-gradient(90deg, rgba(13, 202, 240, 0.1) 0%, rgba(13, 202, 240, 0) 100%);
                color: #fff !important;
            }
            .offcanvas-nav-link i { margin-right: 12px; width: 20px; text-align: center; }
            .navbar-brand .version-badge { font-size: 0.7rem; vertical-align: super; }
            #siteOffcanvas { width: 280px; transition: transform 0.3s ease-in-out; }
        `;
        document.head.appendChild(style);
    }

    function injectNav() {
        const currentPath = window.location.pathname;
        const navId = "siteOffcanvas";
        let highscore;
        try {
            highscore = Number(JSON.parse(localStorage.getItem('qatt_stats')||"{}")._score||0);
        } catch{
            highscore = 0;
        }
        const isQuiz = currentPath.endsWith("/app.html");
        
        const header = document.createElement('nav');
        header.className = "nav-backdrop navbar navbar-dark fixed-top border-bottom border-secondary shadow-sm";
        header.innerHTML = `
            <div class="container-fluid">
                <a class="navbar-brand fw-bold" href="/chunom">
                    ${navConfig.title}<span class="version-badge ms-1 text-warning">v2-alpha</span>
                </a>
                <div class="ms-auto d-flex align-items-center">
                    <a href="/qatt-dc/app.html" class="${isQuiz?'d-none':''} badge rounded-pill border border-success text-success bg-transparent text-decoration-none small me-2 py-1 px-2">
                        🏆 ${highscore}
                    </a>
                    <button class="navbar-toggler border-0" type="button" id="navTogglerCustom">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                </div>
            </div>
        `;

        const offcanvas = document.createElement('div');
        offcanvas.className = "navmenu-backdrop offcanvas offcanvas-end text-light";
        offcanvas.id = navId;
        offcanvas.tabIndex = "-1";

        const sectionsHtml = navConfig.sections.map(section => {
            const linksHtml = section.links.map(link => {
                const isActive = currentPath === link.url;
                return `<a href="${link.url}" class="offcanvas-nav-link ${section.linkClass} ${isActive ? 'active' : ''}">
                            <i class="bi ${link.icon}"></i> ${link.name}
                        </a>`;
            }).join('');
            return `<div class="nav-section-header ${section.themeClass}">${section.header}</div>
                    <div class="nav flex-column">${linksHtml}</div>`;
        }).join('');

        offcanvas.innerHTML = `
            <div class="offcanvas-header border-bottom border-secondary">
                <h5 class="offcanvas-title fw-bold text-white">${navConfig.title}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
            </div>
            <div class="offcanvas-body p-0">${sectionsHtml}</div>
        `;

        document.body.style.paddingTop = "62px";
        document.body.prepend(header);
        document.body.appendChild(offcanvas);

        const initOffcanvas = () => {
            const toggler = document.getElementById('navTogglerCustom');
            const offcanvasEl = document.getElementById(navId);
            
            if (toggler && offcanvasEl && typeof bootstrap !== 'undefined') {
                const bsOffcanvas = new bootstrap.Offcanvas(offcanvasEl);
                toggler.addEventListener('click', (e) => {
                    e.preventDefault();
                    bsOffcanvas.toggle();
                });
            } else if (typeof bootstrap === 'undefined') {
                setTimeout(initOffcanvas, 200);
            }
        };
        initOffcanvas();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            injectDependencies();
            injectNav();
        });
    } else {
        injectDependencies();
        injectNav();
    }
})();
