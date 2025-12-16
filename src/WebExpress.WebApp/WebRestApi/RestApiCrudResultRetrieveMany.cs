using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (many) result of a REST API retrieve operation
    /// that returns a collection of items.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of the returned items. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public class RestApiCrudResultRetrieveMany<TIndexItem> : RestApiCrudResult
        where TIndexItem : IIndexItem
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

        /// <summary>
        /// Returns or sets the collection of retrieved items.
        /// </summary>
        public IEnumerable<TIndexItem> Data { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        public override Response ToResponse()
        {
            var jsonData = JsonSerializer.Serialize(Data, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
            .AddHeaderContentType("application/json");
        }
    }
}