// State Properties Panel
webexpress.webui.DialogPanels.register("workflow-state-properties", {
    id: "workflow-state-properties-page",
    title: "General",
    iconClass: "fas fa-sliders-h",
    render: function(container, modal) {
        container.innerHTML = `
            <div class="p-3">
                <div class="mb-2"><label class="form-label small fw-bold">State ID (Readonly)</label><input type="text" id="inp-id" class="form-control form-control-sm bg-light" readonly></div>
                <div class="mb-2"><label class="form-label small fw-bold">Label</label><input type="text" id="inp-label" class="form-control form-control-sm"></div>
                <div class="mb-2"><label class="form-label small fw-bold">Background</label><input type="color" id="inp-bgcolor" class="form-control form-control-sm form-control-color"></div>
                <div class="mb-2"><label class="form-label small fw-bold">Text Color</label><input type="color" id="inp-fgcolor" class="form-control form-control-sm form-control-color"></div>
            </div>
        `;
    },
    onShow: function(modal) {
        const node = modal.context.node;
        modal._element.querySelector("#inp-id").value = node.id || "";
        modal._element.querySelector("#inp-label").value = node.label || "";
        modal._element.querySelector("#inp-bgcolor").value = node.backgroundColor || "#ffffff";
        modal._element.querySelector("#inp-fgcolor").value = node.foregroundColor || "#000000";
    },
    validate: function(modal) { 
        return true; 
    },
    onSubmit: function(modal) {
        const node = modal.context.node;
        const editor = modal.context.editor;
        
        editor._saveStateToHistory();
        
        const visualNode = editor._nodes.find((n) => { 
            return n.id === node.id; 
        });
        if (visualNode !== undefined) {
            node.x = visualNode.x;
            node.y = visualNode.y;
        }

        node.label = modal._element.querySelector("#inp-label").value;
        node.backgroundColor = modal._element.querySelector("#inp-bgcolor").value;
        node.foregroundColor = modal._element.querySelector("#inp-fgcolor").value;

        editor._buildPhysics();
        editor.render();
        editor._emitChangeSafe();
    }
});