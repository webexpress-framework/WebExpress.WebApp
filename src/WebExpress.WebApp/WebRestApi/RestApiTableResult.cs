using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API call that returns a table structure, 
    /// including metadata, columns, rows, and pagination information.
    /// </summary>
    public class RestApiTableResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

        /// <summary>
        /// Returns or sets the title associated with the object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Returns or sets the collection of columns associated with the table.
        /// </summary>
        public IEnumerable<RestApiTableColumn> Columns { get; set; }

        /// <summary>
        /// Returns or sets the collection of rows in the table.
        /// </summary>
        public IEnumerable<RestApiTableRow> Rows { get; set; }

        /// <summary>
        /// Returns or sets the pagination information for the current API request.
        /// </summary>
        public RestApiPaginationInfo Pagination { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public virtual Response ToResponse()
        {
            var data = new
            {
                title = Title,
                columns = Columns,
                rows = Rows,
                pagination = Pagination
            };

            var jsonData = JsonSerializer.Serialize(data, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
            .AddHeaderContentType("application/json");
        }
    }
}
