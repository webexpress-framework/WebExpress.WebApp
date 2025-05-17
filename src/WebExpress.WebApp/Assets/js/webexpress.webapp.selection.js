/**
 * A selection box.
 * The following events are triggered:
 * - webexpress.webui.Event.CHANGE_FILTER_EVENT
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT
 * - webexpress.webui.Event.DROPDOWN_SHOW_EVENT
 * - webexpress.webui.Event.DROPDOWN_HIDDEN_EVENT 
 */
webexpress.webapp.SelectionCtrl = class extends webexpress.webui.SelectionCtrl {
    _optionUri = "";
    _spinner = $("<div class='spinner-border spinner-border-sm text-secondary ms-2' role='status'/>");

    /**
     * Constructor
     * @param {HTMLElement} element - The DOM element for the selection control.
     */
    constructor(element) {
        super(element);

        this._optionUri = $(element).data("uri") ?? ""; // Retrieve the URI for loading content
        this._optionfilter = function (x, y) { return true; };

        $(this._element).on('show.bs.dropdown', function () {
            this.receiveData(this._filter.val());
        }.bind(this));
    }

     /**
      * Retrieve data from rest api.
      * @param filter Die Filtereinstellungen
      */
    receiveData(filter) {

        filter = filter !== undefined || filter != null ? filter : "";
        this._selection.append(this._spinner);

         $.get(`${this._optionUri}?search=${filter}&page=${this._page}`)
            .done((response) => {
                 this.options = response.options;
                 this.trigger('webexpress.webui.receive.complete');

                 //this.update();

                 this._selection.children("div").remove();
             })
             .fail((error) => {
                console.error("The request could not be completed successfully:", error);
            });
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-selection", webexpress.webapp.SelectionCtrl);