using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides a server-side Scrum REST API for active sprint data.
    /// </summary>
    /// <typeparam name="TIndexScrum">Type of the scrum sprint index item.</typeparam>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiScrumSprint<TIndexScrum, TIndexItem> : IRestApi
        where TIndexScrum : IIndexItem
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets a value indicating whether backlog endpoints are enabled.
        /// </summary>
        protected virtual bool IsBacklogEnabled => false;

        /// <summary>
        /// Gets a value indicating whether active sprint endpoint is enabled.
        /// </summary>
        protected virtual bool IsSprintEnabled => true;

        /// <summary>
        /// Retrieves active sprint overview data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var sprints = RetrieveSprints(new Query<TIndexScrum>(), context, request)
                    .ToList();
                var items = RetrieveItems(new Query<TIndexItem>(), context, request)
                    .ToList();

                return Json(new ResponseOK(), BuildActiveSprintData(sprints.Select(ToRestSprint), items.Select(ToRestItem)));
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext 
        /// interface.
        /// </summary>
        /// <returns>
        /// An IQueryContext instance that can be used to execute queries.
        /// </returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Retrieves a collection of sprints that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// The query used to filter and select sprints. Defines the criteria that 
        /// sprints must meet to be included in
        /// the result.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information
        /// or services required for query evaluation.
        /// </param>
        /// <param name="request">
        /// The request details associated with the operation. May include user 
        /// information, authentication, or other request-specific data.
        /// </param>
        /// <returns>
        /// An enumerable collection of sprints that satisfy the query criteria. The
        /// collection is empty if no sprints match.
        /// </returns>
        protected abstract IEnumerable<TIndexScrum> RetrieveSprints(IQuery<TIndexScrum> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Retrieves a collection of Scrum items that match the specified 
        /// query criteria.
        /// </summary>
        /// <param name="query">
        /// The query that defines the criteria for selecting Scrum items. Cannot 
        /// be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request object containing details about the current API request. 
        /// Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of Scrum items that satisfy the query 
        /// criteria. The collection is empty if no items match.
        /// </returns>
        protected abstract IEnumerable<TIndexItem> RetrieveItems(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Serializes the specified object as JSON and sets the response content 
        /// accordingly.
        /// </summary>
        /// <param name="response">
        /// The response whose content and Content-Type header will be updated.
        /// </param>
        /// <param name="data">
        /// The object to serialize as JSON and write into the response. Cannot 
        /// be null.
        /// </param>
        /// <returns>
        /// The updated response containing the JSON‑serialized content and the 
        /// Content-Type header
        /// set to "application/json".
        /// </returns>
        private static Response Json(Response response, object data)
        {
            response.Content = JsonSerializer.SerializeToUtf8Bytes(data, _jsonOptions);
            return response.AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Converts the specified sprint identifier string to a nullable GUID if it
        /// is a valid GUID representation.
        /// </summary>
        /// <param name="sprintId">
        /// The sprint identifier to normalize. Must be a string representation of
        /// a GUID or null.
        /// </param>
        /// <returns>
        /// A GUID value if the input string is a valid GUID; otherwise, null.
        /// </returns>
        protected static Guid? NormalizeSprintId(string sprintId)
        {
            return Guid.TryParse(sprintId, out var sprintIdValue) ? sprintIdValue : null;
        }

        /// <summary>
        /// Calculates the next available rank value for items within the 
        /// specified sprint.
        /// </summary>
        /// <param name="items">
        /// A collection of items to evaluate for determining the next rank. Each 
        /// item must have a SprintId and Rank property.
        /// </param>
        /// <param name="sprintId">
        /// The identifier of the sprint to filter items by. If null, items with a 
        /// null SprintId are considered.
        /// </param>
        /// <returns>
        /// The next rank value, which is one greater than the highest rank among 
        /// items in the specified sprint. Returns 1 if no items are found.
        /// </returns>
        protected static int NextRank(IEnumerable<RestApiScrumItem> items, Guid? sprintId)
        {
            var sid = sprintId;
            return items
                .Where(x => x.SprintId == sid.ToString())
                .Select(x => x.Rank)
                .DefaultIfEmpty(0)
                .Max() + 1;
        }

        /// <summary>
        /// Normalizes the ranking of the specified Scrum items within a given sprint 
        /// by reassigning their ranks.
        /// </summary>
        /// <param name="items">
        /// The collection of Scrum items whose ranks should be normalized.  
        /// Each element must have a valid sprint ID and rank value.
        /// </param>
        /// <param name="sprintId">
        /// The unique identifier of the sprint for which rank normalization should 
        /// be performed.  
        /// If null, no items are processed.
        /// </param>
        protected static void NormalizeRanks(IEnumerable<RestApiScrumItem> items, Guid? sprintId)
        {
            var sid = sprintId;
            var orderedItems = items
                .Where(x => x.SprintId == sid.ToString())
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            for (var i = 0; i < orderedItems.Count; i++)
            {
                orderedItems[i].Rank = i + 1;
            }
        }

        /// <summary>
        /// Reorders the specified item within a collection of Scrum items for a 
        /// given sprint, updating ranks to reflect the new order.
        /// </summary>
        /// <param name="items">
        /// The collection of Scrum items to be reordered. Only items belonging to 
        /// the specified sprint are affected.
        /// </param>
        /// <param name="item">
        /// The Scrum item to move to a new rank within the sprint.
        /// </param>
        /// <param name="sprintId">
        /// The identifier of the sprint in which to reorder the item. If null, only 
        /// items with a null sprint are considered.
        /// </param>
        /// <param name="requestedRank">
        /// The desired rank (1-based) for the item within the sprint. Values outside
        /// the valid range are clamped to the nearest valid position.
        /// </param>
        protected static void ReorderItem(IEnumerable<RestApiScrumItem> items, RestApiScrumItem item, Guid? sprintId, int requestedRank)
        {
            var sid = sprintId;
            var rankedItems = items
                .Where(x => x.Id != item.Id)
                .Where(x => x.SprintId == sid.ToString())
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            var index = Math.Clamp(requestedRank, 1, rankedItems.Count + 1) - 1;
            rankedItems.Insert(index, item);

            for (var i = 0; i < rankedItems.Count; i++)
            {
                rankedItems[i].SprintId = sid.ToString();
                rankedItems[i].Rank = i + 1;
            }
        }

        /// <summary>
        /// Closes all active sprints in the specified collection except for the 
        /// sprint with the given active sprint identifier.
        /// </summary>
        /// <param name="sprints">A collection of sprints to evaluate and update. 
        /// Each sprint with an active status, except the one matching the 
        /// specified active sprint identifier, will be closed.
        /// </param>
        /// <param name="activeSprintId">
        /// The unique identifier of the sprint that should remain active. All other
        /// active sprints will be closed.
        /// </param>
        protected static void CloseOtherActiveSprints(IEnumerable<RestApiScrumSprintItem> sprints, Guid activeSprintId)
        {
            foreach (var sprint in sprints.Where(x => x.Id != activeSprintId.ToString()))
            {
                if (string.Equals(sprint.Status, "active", StringComparison.OrdinalIgnoreCase))
                {
                    sprint.Status = "closed";
                }
            }
        }

        /// <summary>
        /// Creates an overview of the active sprint, including progress and burndown
        /// data, based on the provided sprints and items.
        /// </summary>
        /// <param name="sprints">
        /// The collection of all available sprints.  
        /// Must contain at least one active sprint for an overview to be generated.
        /// </param>
        /// <param name="items">
        /// The collection of all Scrum items assigned to the sprints.  
        /// Items are used to calculate progress and burndown data.
        /// </param>
        /// <returns>
        /// An object containing an overview of the active sprint, including name,
        /// timeframe, capacity, progress, and burndown data. Returns null if no 
        /// active sprint is found.
        /// </returns>
        private static RestApiScrumSprintOverview BuildActiveSprintData(IEnumerable<RestApiScrumSprintItem> sprints, IEnumerable<RestApiScrumItem> items)
        {
            var sprintList = sprints?.ToList() ?? [];
            var itemList = items?.ToList() ?? [];
            var sprint = sprintList.FirstOrDefault(x => string.Equals(x.Status, "active", StringComparison.OrdinalIgnoreCase));
            if (sprint is null)
            {
                return null;
            }

            var sprintItems = itemList
                .Where(x => x.SprintId == sprint.Id)
                .OrderBy(x => x.Rank)
                .ToList();

            var committedPoints = sprintItems.Sum(x => x.Points);
            var completedPoints = sprintItems
                .Where(x => string.Equals(x.Status, "done", StringComparison.OrdinalIgnoreCase))
                .Sum(x => x.Points);
            var totalItems = sprintItems.Count;
            var completedItems = sprintItems.Count(x => string.Equals(x.Status, "done", StringComparison.OrdinalIgnoreCase));

            var start = ParseDate(sprint.Start);
            var end = ParseDate(sprint.End);
            var daysTotal = CalculateDaysTotal(start, end);
            var daysElapsed = CalculateDaysElapsed(start, end);
            var remainingPoints = Math.Max(0, committedPoints - completedPoints);

            return new RestApiScrumSprintOverview
            {
                Name = sprint.Name,
                Goal = sprint.Goal,
                Status = sprint.Status,
                Start = sprint.Start,
                End = sprint.End,
                DaysTotal = daysTotal,
                DaysElapsed = daysElapsed,
                Capacity = sprint.Capacity,
                CommittedPoints = committedPoints,
                CompletedPoints = completedPoints,
                TotalItems = totalItems,
                CompletedItems = completedItems,
                Burndown = new RestApiScrumBurndown
                {
                    Ideal = BuildIdealBurndown(committedPoints, daysTotal),
                    Actual = BuildActualBurndown(committedPoints, remainingPoints, daysElapsed)
                }
            };
        }

        /// <summary>
        /// Parses a date value from a string in the format "yyyy-MM-dd".
        /// </summary>
        /// <param name="value">
        /// The string to parse, which must contain a date in the format "yyyy-MM-dd".
        /// May be null or empty.
        /// </param>
        /// <returns>
        /// A <see cref="DateTime"/> value representing the parsed date,  
        /// or null if the input is invalid or does not match the expected format.
        /// </returns>
        private static DateTime? ParseDate(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            if (DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var date))
            {
                return date.Date;
            }

            return null;
        }

        /// <summary>
        /// Calculates the number of full days between two date values.
        /// </summary>
        /// <param name="start">
        /// The optional start date. Must be less than or equal to the end date
        /// for a positive day count to be calculated.
        /// </param>
        /// <param name="end">
        /// The optional end date. Must be greater than or equal to the start date
        /// for a positive day count to be calculated.
        /// </param>
        /// <returns>
        /// The number of full days between the start and end dates.  
        /// Returns 0 if either date is not provided or if the end date is earlier 
        /// than the start date.
        /// </returns>
        private static int CalculateDaysTotal(DateTime? start, DateTime? end)
        {
            if (!start.HasValue || !end.HasValue || end.Value < start.Value)
            {
                return 0;
            }

            return Math.Max(0, (end.Value.Date - start.Value.Date).Days);
        }

        /// <summary>
        /// Calculates the number of days that have elapsed between the specified 
        /// start date and today, constrained by the total possible days between 
        /// the start and end dates.
        /// </summary>
        /// <param name="start">
        /// The start date from which to begin counting elapsed days. If null, 
        /// the method returns 0.
        /// </param>
        /// <param name="end">
        /// The end date that defines the maximum range for elapsed days. If null, 
        /// the method returns 0.
        /// </param>
        /// <returns>
        /// The number of days that have elapsed from the start date to today, limited
        /// to the range between start and end. Returns 0 if either date is null or 
        /// if today is before or on the start date.
        /// </returns>
        private static int CalculateDaysElapsed(DateTime? start, DateTime? end)
        {
            if (!start.HasValue || !end.HasValue)
            {
                return 0;
            }

            var today = DateTime.UtcNow.Date;
            if (today <= start.Value.Date)
            {
                return 0;
            }

            var total = CalculateDaysTotal(start, end);
            return Math.Clamp((today - start.Value.Date).Days, 0, total);
        }

        /// <summary>
        /// Calculates the ideal burndown curve for a sprint based on the 
        /// committed points and the total number of days.
        /// </summary>
        /// <param name="committedPoints">
        /// The total number of work points committed at the beginning of the sprint.
        /// </param>
        /// <param name="daysTotal">
        /// The total number of days in the sprint. Must be greater than 0 to compute a
        /// linear burndown curve.
        /// </param>
        /// <returns>
        /// An array of double values representing the remaining work points for 
        /// each day of the sprint. The array starts with the initial point value 
        /// and ends with 0.
        /// </returns>
        private static double[] BuildIdealBurndown(int committedPoints, int daysTotal)
        {
            if (daysTotal <= 0)
            {
                return [committedPoints, 0];
            }

            var result = new double[daysTotal + 1];
            for (var i = 0; i <= daysTotal; i++)
            {
                result[i] = Math.Round(committedPoints - ((double)committedPoints / daysTotal * i), 1);
            }

            return result;
        }

        /// <summary>
        /// Calculates the actual burndown progression for a sprint based on the
        /// remaining and originally committed story points, as well as the number
        /// of elapsed days.
        /// </summary>
        /// <param name="committedPoints">
        /// The total number of story points committed at the beginning of the sprint.
        /// </param>
        /// <param name="remainingPoints">
        /// The number of story points still remaining after the specified number of
        /// days.
        /// </param>
        /// <param name="daysElapsed">
        /// The number of days that have passed since the start of the sprint. Must be 
        /// greater than or equal to 0.
        /// </param>
        /// <returns>
        /// An array of double values representing the remaining workload for each day
        /// from day 0
        /// up to the specified day.  
        /// The array contains one value per day; if daysElapsed <= 0, the array 
        /// contains only the committed story point value.
        /// </returns>
        private static double[] BuildActualBurndown(int committedPoints, int remainingPoints, int daysElapsed)
        {
            if (daysElapsed <= 0)
            {
                return [committedPoints];
            }

            var result = new double[daysElapsed + 1];
            for (var i = 0; i <= daysElapsed; i++)
            {
                var progress = (double)i / daysElapsed;
                result[i] = Math.Round(committedPoints - ((committedPoints - remainingPoints) * progress), 1);
            }

            return result;
        }

        /// <summary>
        /// Creates a new instance of the RestApiScrumSprint class that is a copy 
        /// of the specified sprint.
        /// </summary>
        /// <remarks>The cloned instance is a shallow copy; reference-type properties 
        /// are not deeply cloned.
        /// </remarks>
        /// <param name="sprint">
        /// The RestApiScrumSprint instance to clone. Cannot be null.
        /// </param>
        /// <returns>
        /// A new RestApiScrumSprint object with the same property values as the 
        /// specified sprint.
        /// </returns>
        protected static RestApiScrumSprintItem Clone(RestApiScrumSprintItem sprint)
        {
            return new RestApiScrumSprintItem
            {
                Id = sprint.Id,
                Name = sprint.Name,
                Goal = sprint.Goal,
                Status = sprint.Status,
                Start = sprint.Start,
                End = sprint.End,
                Capacity = sprint.Capacity
            };
        }

        /// <summary>
        /// Creates a new instance of a RestApiScrumItem that is a copy of the 
        /// specified item.
        /// </summary>
        /// <remarks>
        /// The cloned item is a shallow copy; reference-type properties are not 
        /// deeply cloned. Use this method to duplicate an item without affecting 
        /// the original instance.
        /// </remarks>
        /// <param name="item">
        /// The RestApiScrumItem to clone. Cannot be null.
        /// </param>
        /// <returns>
        /// A new RestApiScrumItem instance with property values copied from the 
        /// specified item.
        /// </returns>
        protected static RestApiScrumItem Clone(RestApiScrumItem item)
        {
            return new RestApiScrumItem
            {
                Id = item.Id,
                Type = item.Type,
                Icon = item.Icon,
                Key = item.Key,
                Title = item.Title,
                Priority = item.Priority,
                Points = item.Points,
                SprintId = item.SprintId,
                Status = item.Status,
                Rank = item.Rank
            };
        }

        /// <summary>
        /// Converts a sprint model instance into the REST sprint DTO.
        /// </summary>
        /// <param name="sprint">The sprint model.</param>
        /// <returns>The REST sprint DTO.</returns>
        protected virtual RestApiScrumSprintItem ToRestSprint(TIndexScrum sprint)
        {
            if (sprint is RestApiScrumSprintItem restSprint)
            {
                return Clone(restSprint);
            }

            return new RestApiScrumSprintItem
            {
                Id = sprint.Id.ToString()
            };
        }

        /// <summary>
        /// Converts an item model instance into the REST item DTO.
        /// </summary>
        /// <param name="item">The item model.</param>
        /// <returns>The REST item DTO.</returns>
        protected virtual RestApiScrumItem ToRestItem(TIndexItem item)
        {
            if (item is RestApiScrumItem restItem)
            {
                return Clone(restItem);
            }

            return new RestApiScrumItem
            {
                Id = item.Id.ToString()
            };
        }
    }
}
