// Postfunction Management Panel (Flat List Structure)
webexpress.webui.DialogPanels.register("workflow-postfunction-management", {
    id: "workflow-postfunction-management-page",
    render: function(container, modal) {
        container.innerHTML = `
            <div class="border rounded p-2 mb-3 bg-light" id="list-container" style="min-height:150px; max-height:300px; overflow-y:auto;"></div>
            <div class="d-flex gap-2">
                <select class="form-select form-select-sm" id="item-select" disabled><option>loading...</option></select>
                <button class="btn btn-sm btn-outline-secondary" id="add-btn" disabled type="button">Add Postfunction</button>
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
                listContainer.innerHTML = `<span class="text-muted small">no postfunctions configured.</span>`;
                return;
            }

            for (let i = 0; i < modal.localData.length; i++) {
                const node = modal.localData[i];
                const row = document.createElement("div");
                row.className = "d-flex align-items-center mb-1";
                
                row.innerHTML = `<i class="fas fa-bolt text-info me-2"></i><span class="flex-grow-1 small">${node.label}</span>`;
                
                const del = document.createElement("span");
                del.className = "text-danger ms-2 fw-bold";
                del.style.cursor = "pointer";
                del.textContent = "x";
                
                const currentIndex = i;
                del.onclick = () => {
                    modal.localData.splice(currentIndex, 1);
                    renderList();
                };
                
                row.appendChild(del);
                listContainer.appendChild(row);
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
                    id: "postfunc_" + Date.now(),
                    type: tpl.type || "action",
                    label: tpl.label
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
                        select.innerHTML = "<option>no postfunctions available</option>";
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
                    console.error("failed to load postfunctions:", err);
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