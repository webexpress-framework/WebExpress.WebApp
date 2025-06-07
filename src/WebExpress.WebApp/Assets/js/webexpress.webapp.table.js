/**
 * A rest table control extending the base Control class with column reordering functionality and visual indicators.
 * The following events are triggered:
 * - webexpress.webui.Event.TABLE_SORT_EVENT
 * - webexpress.webui.Event.COLUMN_REORDER_EVENT
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrl {
    _restUri = "";
    _titleDiv = $("<h3>").addClass("me-auto");
    _progressDiv = $("<div role='status' style='height: 0.5em'>")
        .addClass("progress")
        .append($("<div class='progress-bar progress-bar-striped progress-bar-animated' style='width: 100%'>"));
    _filterDiv = $("<div class='col-3'>");
    _filterCtrl = null;
    _statusDiv = $("<span>");
    _paginationDiv = $("<div class='justify-content-end'>");
    _paginationCtrl = null;
    _filter = null;
    _page = 0;
    _previewColumns = [ 
        { label: "<span class='placeholder col-6 placeholder-lg'></span>" }, 
        { label: "<span class='placeholder col-6 placeholder-lg'></span>" }, 
        { label: "<span class='placeholder col-6 placeholder-lg'></span>" }];
    _previewBody = [
        { cells: [ { text: "<span class='placeholder col-7'></span>" }, { text: "<span class='placeholder col-5'></span>" }, { text: "<span class='placeholder col-6'></span>" } ] },
        { cells: [ { text: "<span class='placeholder col-6'></span>" }, { text: "<span class='placeholder col-7'></span>" }, { text: "<span class='placeholder col-5'></span>" } ] },
        { cells: [ { text: "<span class='placeholder col-6'></span>" }, { text: "<span class='placeholder col-6'></span>" }, { text: "<span class='placeholder col-7'></span>" } ] }];

    /**
     * Constructor
     * @param {HTMLElement} element - The DOM element associated with the modal control.
     */
    constructor(element) {
        super(element);

        this._restUri = $(element).data("uri") ?? ""; // Retrieve the URI for loading content
        
        // Cleanup the DOM element
        $(this._element)
            .removeAttr("data-uri");

        // Show placeholder while loading content           
        $(this._element).prepend($("<div>").addClass("wx-table-toolbar").append(this._titleDiv, this._filterDiv), this._progressDiv);
        $(this._element).append($("<div>").addClass("wx-table-statusbar").append(this._statusDiv, this._paginationDiv));
        
        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        
        this._table.addClass("placeholder-glow");
            
        this.render();
        
        this._filterCtrl = new webexpress.webui.SearchCtrl(this._filterDiv[0]);
        $(document).on(webexpress.webui.Event.CHANGE_FILTER_EVENT, (event, data) => { 
            if(data.sender && data.sender === this._filterDiv[0]) {
                this._filter = data.value;
                this._receiveData();
            }
        });
        
        this._paginationCtrl = new webexpress.webui.PaginationCtrl(this._paginationDiv[0]);
        $(document).on(webexpress.webui.Event.CHANGE_PAGE_EVENT, (event, data) => { 
            if (data.sender && data.sender === this._paginationDiv[0]) {
                this._page = data.page;
                this._receiveData();

                // scroll to the top of the table
                window.scrollTo(0, $(this._element).offset().top);
            }
        });
        
        this._receiveData();
    }

    /**
     * Retrieve data from rest api.
     */
    _receiveData() {
        this._progressDiv.css("visibility", "visible");
        
        $.get(`${this._restUri}?filter=${this._filter}&page=${this._page}`)
            .done((response) => {

                const page = response.page ?? 0; // current page number
                const pageSize = response.pageSize ?? 50; // number of items per page
                const total = response.total ?? 0; // total number of items
                const totalPages = Math.ceil(total / pageSize); // calculate the total number of pages
                const startIndex = page * pageSize + 1; // calculate the index of the first item on the current page
                const endIndex = Math.min(startIndex + pageSize - 1, total); // calculate the index of the last item on the current page

                this._columns = response.columns;
                this._rows = response.rows;
                this._titleDiv.text(response.title);
                this._statusDiv.text(`${startIndex} - ${endIndex} / ${total}`);
                
                // Trigger event when data has successfully arrived
                $(this._element).trigger(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    id: $(this._element).attr("id"),
                    response: response
                });
                this._paginationCtrl.total = totalPages;
                this._paginationCtrl.page = page;
                
                this._table.removeClass("placeholder-glow");
                
                this._hasOptions = Array.isArray(this._rows) && this._rows.some(row => row.options?.length > 0);
                
                if (this._options?.length > 0) {
                    this._hasOptions = true;
                }
                
                this.render();
                
                this._progressDiv.css("visibility", "hidden");
            })
            .fail((error) => {
                console.error("The request could not be completed successfully:", error);
            });
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);