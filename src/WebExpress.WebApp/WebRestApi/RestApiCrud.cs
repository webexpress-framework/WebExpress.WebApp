using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD operations for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiCrud<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public virtual Response GetData(Request request)
        {
            var pageSize = 50;
            var filter = request.GetParameter("search")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var page = request.GetParameter("page");
            var pageNumber = !string.IsNullOrWhiteSpace(page?.Value) ? Convert.ToInt32(page?.Value) : 0;

            try
            {
                IEnumerable<TIndexItem> data = [];

                if (!string.IsNullOrWhiteSpace(wql))
                {
                    var wqlStatement = WebEx.ComponentHub.GetComponentManager<WebIndex.IndexManager>()?
                        .Retrieve<TIndexItem>(wql);

                    data = GetData(wqlStatement, request);
                }
                else
                {
                    data = GetData(filter, request);
                }

                var result = new RestApiResult()
                {
                    Data = data.Skip(pageSize * pageNumber).Take(pageSize),
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalCount = data.Count()
                    }
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="wql">The filtering and sorting options.</param>
        /// <param name="request">The request.</param>
        /// <returns>An enumeration of which json serializer can be serialized.</returns>
        public virtual IEnumerable<TIndexItem> GetData(IWqlStatement<TIndexItem> wql, Request request)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="filter">The filtering and sorting options.</param>
        /// <param name="request">The request.</param>
        /// <returns>An enumeration of which json serializer can be serialized.</returns>
        public virtual IEnumerable<TIndexItem> GetData(string filter, Request request)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Creates data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public virtual Response CreateData(Request request)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Updates data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public virtual Response UpdateData(Request request)
        {
            var id = request.GetParameter("id")?.Value;

            var errors = UpdateData(id, request);

            var result = new RestApiResult()
               .AddError(errors);

            return result.ToResponse();
        }

        /// <summary>
        /// Updates data.
        /// </summary>
        /// <param name="id">The id of the data to delete.</param>
        /// <param name="request">The request.</param>
        /// <returns>An enumeration of validation errors or null.</returns>
        public virtual IEnumerable<RestApiError> UpdateData(string id, Request request)
        {
            return [];
        }

        /// <summary>
        /// Deletes data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public virtual Response DeleteData(Request request)
        {
            var id = request.GetParameter("id")?.Value;
            DeleteData(id, request);

            return new ResponseOK();
        }

        /// <summary>
        /// Deletes data.
        /// </summary>
        /// <param name="id">The id of the data to delete.</param>
        /// <param name="request">The request.</param>
        public virtual void DeleteData(string id, Request request)
        {
            throw new NotImplementedException();
        }
    }
}
