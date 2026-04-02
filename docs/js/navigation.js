window.addEventListener("load",
        function() {
            const navConfig = {
                title: "Chunom.org",
                links: [
                    { name: "Học QATT", url: "/qatt-dc/app.html" },
                    //{ name: "Hướng dẫn / Tutorial", url: "tutorial.html" },
                    { name: "QATT Wiki", url: "/qatt-dc/wiki.html" },
                    { name: "Logo Creator", url: "/qatt-dc/logo-creator.html" },
                        { name: "Chữ Nôm", url: "/chunom" },
                ]
            };

            function injectNav() {
                const currentPath = window.location.pathname;
                const nav = document.createElement('nav');
                nav.style.backgroundColor = "rgba(20, 35, 55, 0.8)";
                nav.style.backdropFilter = "blur(8px)";
                nav.className = "navbar navbar-expand-lg navbar-dark fixed-top shadow-sm";
                
                const navLinks = navConfig.links.map(link => {
                    // Verbesserte Active-Erkennung für lokale Dateien und Pfade
                    const isActive = currentPath.includes(link.url);
                    return `
                        <li class="nav-item">
                            <a class="nav-link ${isActive ? 'active fw-bold' : ''}" 
                               href="${link.url}" 
                               ${isActive ? 'aria-current="page"' : ''}>
                                ${link.name}
                            </a>
                        </li>
                    `;
                }).join('');

                nav.innerHTML = `
                    <div class="container">
                        <a class="navbar-brand d-flex align-items-center" href="index.html">
                            <span class="fw-bold tracking-tight">${navConfig.title}</span>
                        </a>
                        <button class="navbar-toggler" type="button" aria-label="Toggle navigation">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="navbar-nav ms-auto">
                                ${navLinks}
                            </ul>
                        </div>
                    </div>
                `;

                // --- FIX: MANUELLER TOGGLE ---
                const toggler = nav.querySelector('.navbar-toggler');
                const collapse = nav.querySelector('.navbar-collapse');
                
                toggler.addEventListener('click', function() {
                    // Wir schalten die Klasse "show" manuell um, 
                    // damit wir nicht auf das Bootstrap-JS warten müssen
                    collapse.classList.toggle('show');
                });

                document.body.style.paddingTop = "70px"; 
                document.body.prepend(nav);
            }
            injectNav();
        });
