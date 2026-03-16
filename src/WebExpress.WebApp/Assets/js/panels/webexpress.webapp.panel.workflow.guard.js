// Guard Management Panel (Tree Structure)
webexpress.webui.DialogPanels.register("workflow-guard-management", {
    id: "workflow-guard-management-page",
    render: function(container, modal) {
        container.innerHTML = `
            <div class="border rounded p-2 mb-3 bg-light" id="list-container" style="min-height:150px; max-height:300px; overflow-y:auto;"></div>
            <div class="d-flex gap-2">
                <select class="form-select form-select-sm" id="item-select" disabled><option>loading...</option></select>
                <button class="btn btn-sm btn-outline-secondary" id="add-btn" disabled type="button">Add Guard</button>
            </div>
        `;
    },
    onShow: function(modal) {
        const ctx = modal.context;
        modal.localData = JSON.parse(JSON.stringify(ctx.items || []));
        modal.availableTemplates = [];

        const listContainer = modal._element.querySelector("#list-container");
        const select = modal._element.querySelector("#item-select");
        const addBtn = modal._element.querySelector("#add-btn");

        const renderList = () => {
            listContainer.innerHTML = "";
            
            if (modal.localData.length === 0) {
                listContainer.innerHTML = `<span class="text-muted small">no guards configured.</span>`;
                return;
            }

            const renderNode = (parentEl, node, parentArr) => {
                const row = document.createElement("div");
                row.className = "d-flex align-items-center mb-1 ms-3";
                
                const iconClass = (node.type === "AND" || node.type === "OR") ? "fas fa-folder text-warning" : "fas fa-shield-alt text-secondary";
                row.innerHTML = `<i class="${iconClass} me-2"></i><span class="flex-grow-1 small">${node.label}</span>`;
                
                const del = document.createElement("span");
                del.className = "text-danger ms-2 fw-bold";
                del.style.cursor = "pointer";
                del.textContent = "x";
                del.onclick = () => {
                    const idx = parentArr.indexOf(node);
                    if (idx !== -1) {
                        parentArr.splice(idx, 1);
                    }
                    renderList();
                };
                
                row.appendChild(del);
                parentEl.appendChild(row);
                
                if (Array.isArray(node.children)) {
                    for (let i = 0; i < node.children.length; i++) {
                        renderNode(parentEl, node.children[i], node.children);
                    }
                }
            };
            
            for (let i = 0; i < modal.localData.length; i++) {
                renderNode(listContainer, modal.localData[i], modal.localData);
            }
        };
        
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        
        newAddBtn.onclick = () => {
            const selectedId = select.value;
            const tpl = modal.availableTemplates.find((t) => { 
                return t.id === selectedId; 
            });
            
            if (tpl !== undefined) {
                modal.localData.push({
                    id: "guard_" + Date.now(),
                    type: tpl.type || "condition",
                    label: tpl.label,
                    children: []
                });
                renderList();
            }
        };

        renderList();

        if (ctx.fetchUri !== "") {
            fetch(ctx.fetchUri)
                .then((res) => { 
                    return res.json(); 
                })
                .then((data) => {
                    modal.availableTemplates = Array.isArray(data.items) ? data.items : data;
                    select.innerHTML = "";
                    select.disabled = false;
                    newAddBtn.disabled = false;
                    
                    if (modal.availableTemplates.length === 0) {
                        select.innerHTML = "<option>no guards available</option>";
                        newAddBtn.disabled = true;
                    } else {
                        for (let i = 0; i < modal.availableTemplates.length; i++) {
                            const tpl = modal.availableTemplates[i];
                            const opt = document.createElement("option");
                            opt.value = tpl.id;
                            opt.textContent = tpl.label;
                            select.appendChild(opt);
                        }
                    }
                }).catch((err) => {
                    console.error("failed to load guards:", err);
                    select.innerHTML = "<option>error loading</option>";
                });
        }

        const submitBtn = modal._element.querySelector(".submit-btn");
        if (submitBtn !== null && submitBtn.dataset.bound !== "true") {
            submitBtn.dataset.bound = "true";
            submitBtn.addEventListener("click", () => {
                if (this.validate(modal) === true) {
                    this.onSubmit(modal);
                }
            });
        }
    },
    validate: function(modal) { 
        return true; 
    },
    onSubmit: function(modal) {
        modal.context.onSave(modal.localData);
        if (typeof modal.closeAndClean === "function") {
            modal.closeAndClean();
        }
    }
});