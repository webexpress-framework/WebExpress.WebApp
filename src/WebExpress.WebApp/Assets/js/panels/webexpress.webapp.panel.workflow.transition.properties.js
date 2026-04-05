// Transition Properties Panel
webexpress.webui.DialogPanels.register("workflow-transition-properties", {
    id: "workflow-transition-properties-page",
    title: "General",
    iconClass: "fas fa-sliders-h",
    render: function(container, modal) {
        container.innerHTML = `
            <div class="p-3">
                <div class="mb-2"><label class="form-label small fw-bold">Label*</label><input type="text" id="inp-label" class="form-control form-control-sm"></div>
                <div class="mb-2"><label class="form-label small fw-bold">Form</label><input type="text" id="inp-form" class="form-control form-control-sm"></div>
                <div class="mb-2"><label class="form-label small fw-bold">Description</label><input type="text" id="inp-desc" class="form-control form-control-sm"></div>
                <div class="mb-2"><label class="form-label small fw-bold">Color</label><input type="color" id="inp-color" class="form-control form-control-sm form-control-color"></div>
                <div class="mb-2"><label class="form-label small fw-bold">Dash Array</label><input type="text" id="inp-dash" class="form-control form-control-sm"></div>
            </div>
        `;
    },
    onShow: function(modal) {
        const edge = modal.context.edge;
        modal._element.querySelector("#inp-label").value = edge.label || "";
        modal._element.querySelector("#inp-form").value = edge.form || "";
        modal._element.querySelector("#inp-desc").value = edge.description || "";
        modal._element.querySelector("#inp-color").value = edge.color || "#000000";
        modal._element.querySelector("#inp-dash").value = edge.dasharray || "";
    },
    validate: function(modal) { 
        return true; 
    },
    onSubmit: function(modal) {
        const edge = modal.context.edge;
        const editor = modal.context.editor;
        
        editor._saveStateToHistory();
        
        edge.label = modal._element.querySelector("#inp-label").value;
        edge.form = modal._element.querySelector("#inp-form").value;
        edge.description = modal._element.querySelector("#inp-desc").value;
        edge.color = modal._element.querySelector("#inp-color").value;
        edge.dasharray = modal._element.querySelector("#inp-dash").value;

        editor.render();
        editor._emitChangeSafe();
    }
});