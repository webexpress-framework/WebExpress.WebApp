/**
 * Progress bar of a task (WebTask).
 * The following events are triggered:
 * - webexpress.webui.Event.TASK_START_EVENT
 * - webexpress.webui.Event.TASK_UPDATE_EVENT
 * - webexpress.webui.Event.TASK_FINISH_EVENT
 */
webexpress.webapp.TaskProgressBarCtrl = class extends webexpress.webui.Ctrl {
    _interval = null;
    _restUri = "";
    _progress = $("<div class='progress'>").append($("<div role='progressbar' style='width: 0%' aria-valuenow='0' aria-valuemin='0' aria-valuemax='100'>"));
    _message = $("<div class='text-secondary'/>");
    _interval = null;

    /**
     * Constructor
     * @param {HTMLElement} element - The DOM element associated with the modal control.
     */
    constructor(element) {
        super(element);
        
        this._interval = $(element).data("interval") ?? 15000;
        this._restUri = $(element).data("uri") ?? ""; // Retrieve the URI for loading content
        this._size = $(element).data("size") || null;

        this._interval = setInterval(() => {
            this.receiveData();
        }, this._interval);
        
        // Cleanup the DOM element
        $(this._element)
            .empty()
            .removeAttr("data-interval data-uri data-size")
            .addClass("wx-taskprogressbar");
        
        $(this._element).append(this._progress);
        $(this._element).append(this._message);
        
        
        
        this.receiveData();
    }

    /**
     * Retrieve data from rest api.
     */
    receiveData() {        
        $.get(this._restUri)
            .done((response) => {
                const progress = response.progress ?? 0;
                const type = response.tpe ?? "bg-primary";
                const message = response.message ?? "";

                this._progress.children().first().width(Math.min(Math.max(progress, 0), 100) + "%");
                this._progress.children().first()
                    .addClass("progress-bar progress-bar-striped progress-bar-animated")
                    .addClass(type)
                    .addClass(this._size);
                this._message.html(message);
                
                if (response.state == 3) {
                    clearInterval(this._interval);
                    this.trigger('webexpress.webapp.finish', data.Id);
                }
                
            })
            .fail((error) => {
                console.error("The request could not be completed successfully:", error);
            });
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-taskprogressbar", webexpress.webapp.TaskProgressBarCtrl);