using System;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Answers a failed rest request without telling the caller how it failed.
    /// </summary>
    /// <remarks>
    /// The parameters a rest endpoint works from - the sort column, the query, the payload - come
    /// from the client, so an exception raised while handling them is reachable by anyone who can
    /// call the endpoint. Putting the exception into the response hands out stack traces, type and
    /// member names and, through the query providers, fragments of the data model. The detail
    /// belongs in the log, where the operator sees it; the caller learns only that the request
    /// could not be handled. The one exception is a <see cref="RestApiRefusal"/>, whose message
    /// the application wrote for the user.
    /// </remarks>
    public static class RestApiFault
    {
        /// <summary>
        /// Logs the failure and answers with a bounded message, or passes on the reason of a
        /// refusal.
        /// </summary>
        /// <remarks>
        /// A refusal is answered as <c>{ "message": ... }</c>, the json shape the client service
        /// layer keeps from a failed write, so a control can show the reason instead of a bare
        /// status. It is not logged: it is a decision the application made, not a failure the
        /// operator has to look into.
        /// </remarks>
        /// <param name="request">The request being handled, which carries the log to write to.</param>
        /// <param name="ex">The exception to record.</param>
        /// <param name="message">
        /// What could not be done, in terms of the request rather than of the implementation. It is
        /// the message the caller receives, so it must reveal nothing beyond that.
        /// </param>
        /// <param name="member">The member the failure was caught in. Supplied by the compiler.</param>
        /// <param name="line">The line the failure was caught at. Supplied by the compiler.</param>
        /// <param name="file">The file the failure was caught in. Supplied by the compiler.</param>
        /// <returns>
        /// A bad-request response carrying the refusal's reason, or <paramref name="message"/> and
        /// nothing else.
        /// </returns>
        public static IResponse BadRequest
        (
            IRequest request,
            Exception ex,
            string message,
            [CallerMemberName] string member = null,
            [CallerLineNumber] int? line = null,
            [CallerFilePath] string file = null
        )
        {
            if (ex is RestApiRefusal refusal)
            {
                var json = JsonSerializer.Serialize(new { message = refusal.Message });

                return new ResponseBadRequest
                {
                    Content = Encoding.UTF8.GetBytes(json)
                }
                    .AddHeaderContentType("application/json");
            }

            Log(request, ex, message, member, line, file);

            return new ResponseBadRequest(new StatusMessage(message));
        }

        /// <summary>
        /// Records a failure without answering, for a caller that has its own response to give.
        /// </summary>
        /// <param name="request">The request being handled, which carries the log to write to.</param>
        /// <param name="ex">The exception to record.</param>
        /// <param name="message">What could not be done.</param>
        /// <param name="member">The member the failure was caught in. Supplied by the compiler.</param>
        /// <param name="line">The line the failure was caught at. Supplied by the compiler.</param>
        /// <param name="file">The file the failure was caught in. Supplied by the compiler.</param>
        public static void Log
        (
            IRequest request,
            Exception ex,
            string message,
            [CallerMemberName] string member = null,
            [CallerLineNumber] int? line = null,
            [CallerFilePath] string file = null
        )
        {
            // the address is recorded alongside the exception because the parameters that provoked
            // it are in it, and without them the entry cannot be reproduced
            var uri = request?.Uri?.ToString();

            request?.HttpServerContext?.Log?.Error
            (
                message: $"{message} ({uri}): {ex}",
                instance: member,
                line: line,
                file: file
            );
        }
    }
}
