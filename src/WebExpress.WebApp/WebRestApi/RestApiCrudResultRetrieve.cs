using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of items contained in the result. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public class RestApiCrudResultRetrieve<TIndexItem> : RestApiCrudResult, IRestApiCrudResultRetrieve<TIndexItem>
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns or sets the item.
        /// </summary>
        public TIndexItem Data { get; set; }

        /// <summary>
        /// Returns or sets the title.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Returns or sets the prolog for the item.
        /// </summary>
        public string Prolog { get; set; }

        /// <summary>
        /// Returns the size of the modal. 
        /// This property is only relevant when the result is displayed in a modal window.
        /// </summary>
        public TypeModalSize ModalSize { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>
        /// A Response object representing the result of the conversion.
        /// </returns>
        public override IResponse ToResponse()
        {
            var jsonData = JsonSerializer.Serialize(new
            {
                data = Data,
                title = Title,
                prolog = Prolog,
                modalSize = ModalSize.ToClass()
            }, _jsonOptions);

            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
                .AddHeaderContentType("application/json");
        }
    }
}
