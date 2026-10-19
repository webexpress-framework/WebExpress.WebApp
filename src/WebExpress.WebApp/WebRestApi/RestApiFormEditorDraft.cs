using System;
using System.Globalization;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for the draft endpoint of the visual form editor: it
    /// stores the unpublished structure with PUT, answers whether one exists with
    /// GET and drops it with DELETE, for a single form addressed by its form id.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The editor autosaves into the draft after every change, so two editors
    /// drafting the same form would overwrite each other's work without either
    /// user noticing. The draft therefore carries a revision of its own: GET
    /// answers it, every PUT presents the revision it was edited on top of, and a
    /// PUT presenting another one - or presenting one while the draft has been
    /// published or discarded in the meantime - is answered with 409 and the
    /// current revision as <c>{ "message", "revision" }</c> instead of being
    /// stored. The editor keeps its changes and lets the user decide.
    /// </para>
    /// <para>
    /// Publishing is not done here: the data endpoint applies the structure and
    /// ends the draft inside its own transaction, typically by calling the store
    /// behind <see cref="DeleteDraft"/> from its <c>UpdateItem</c>.
    /// </para>
    /// </remarks>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiFormEditorDraft<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,

            // a node the editor builds itself is written as { id, kind, ... }, see
            // RestApiFormEditor for why the discriminator may not lead
            AllowOutOfOrderMetadataProperties = true
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiFormEditorDraft()
        {
        }

        /// <summary>
        /// Answers whether an unpublished draft exists, when it was last written and
        /// its revision, as <c>{ "draft", "updated", "revision" }</c>.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response carrying the draft state.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing form id."));
            }

            try
            {
                using var context = CreateContext();
                var draft = RetrieveDraft(id, context, request);

                return Json(new
                {
                    draft = draft is not null,
                    updated = draft?.Updated?.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture),
                    revision = draft?.Revision ?? 0
                });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Stores the incoming structure as the unpublished draft, unless it was
        /// edited on top of another revision than the one stored.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response carrying the new revision, or the conflict.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing form id."));
            }

            try
            {
                if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
                {
                    return new ResponseBadRequest(new StatusMessage("Missing request body."));
                }

                var incoming = JsonSerializer.Deserialize<RestApiFormEditorItem>(Encoding.UTF8.GetString(requestData.Content), _jsonOptions);

                if (incoming is null)
                {
                    return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."));
                }

                using var context = CreateContext();

                // a draft that ended meanwhile counts as revision 0, so an editor still
                // working on it does not re-open it on top of a newer publication
                var current = RetrieveDraft(id, context, request)?.Revision ?? 0;
                if (incoming.DraftRevision != current)
                {
                    return Conflict(id, current);
                }

                var stored = StoreDraft(id, incoming, context, request);
                if (stored is null)
                {
                    return Conflict(id, RetrieveDraft(id, context, request)?.Revision ?? 0);
                }

                return Json(new
                {
                    draft = true,
                    updated = stored?.Updated?.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture),
                    revision = stored?.Revision ?? 0
                });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Discards the unpublished draft.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The empty response.</returns>
        [Method(RequestMethod.DELETE)]
        public IResponse Remove(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing form id."));
            }

            try
            {
                using var context = CreateContext();
                DeleteDraft(id, context, request);

                return new ResponseNoContent();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext interface.
        /// </summary>
        /// <returns>An IQueryContext instance that can be used to execute queries.</returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Retrieves the unpublished draft of the form.
        /// </summary>
        /// <param name="formId">The id of the form. Never null or whitespace.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The draft, or <c>null</c> when the form has none.</returns>
        protected abstract RestApiFormEditorDraftItem RetrieveDraft(string formId, IQueryContext context, IRequest request);

        /// <summary>
        /// Stores the structure as the unpublished draft of the form. The revision
        /// check has already passed; the store has to move the revision on.
        /// </summary>
        /// <remarks>
        /// The check and the store are two calls. A store that serves concurrent
        /// writers compares <see cref="RestApiFormEditorItem.DraftRevision"/> with its
        /// stored revision again inside its own transaction and returns
        /// <c>null</c> when they differ, which is answered as the same conflict.
        /// </remarks>
        /// <param name="formId">The id of the form. Never null or whitespace.</param>
        /// <param name="item">The drafted structure, carrying the revision it was edited on top of.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The stored draft with its new revision, or <c>null</c> to refuse a stale save.</returns>
        protected abstract RestApiFormEditorDraftItem StoreDraft(string formId, RestApiFormEditorItem item, IQueryContext context, IRequest request);

        /// <summary>
        /// Drops the unpublished draft of the form. Dropping a draft that does not
        /// exist is not an error.
        /// </summary>
        /// <param name="formId">The id of the form. Never null or whitespace.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        protected abstract void DeleteDraft(string formId, IQueryContext context, IRequest request);

        /// <summary>
        /// Answers a draft save that was edited on top of another revision, naming
        /// the stored one so the editor can write on top of it once the user decided.
        /// </summary>
        /// <param name="formId">The id of the form.</param>
        /// <param name="revision">The revision currently stored, 0 when there is no draft.</param>
        /// <returns>The conflict response.</returns>
        private static IResponse Conflict(string formId, int revision)
        {
            var json = JsonSerializer.Serialize(new
            {
                message = $"The draft of the form '{formId}' has been changed by someone else.",
                revision
            });

            return new ResponseConflict
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Answers a json body.
        /// </summary>
        /// <param name="value">The value to serialize.</param>
        /// <returns>The response.</returns>
        private static IResponse Json(object value)
        {
            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))
            }
                .AddHeaderContentType("application/json");
        }
    }
}
