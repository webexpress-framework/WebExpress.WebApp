using System;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a concrete test implementation of the Scrum REST API.
    /// </summary>
    public sealed class TestRestApiScrum : RestApiScrumBacklog<TestRestApiScrum.SprintIndexItem, TestRestApiScrum.ItemIndexItem>
    {
        private readonly List<SprintIndexItem> _sprints =
        [
            new SprintIndexItem
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Name = "Sprint 24",
                Goal = "Customer-Portal MVP launch-ready",
                Status = "active",
                Start = "2026-04-29",
                End = "2026-05-13",
                Capacity = 60
            },
            new SprintIndexItem
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000002"),
                Name = "Sprint 25",
                Goal = "Improve self-service onboarding",
                Status = "planned",
                Start = "2026-05-14",
                End = "2026-05-28",
                Capacity = 55
            },
            new SprintIndexItem
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000003"),
                Name = "Sprint 26",
                Goal = "Stabilize billing workflows",
                Status = "planned",
                Start = "2026-05-29",
                End = "2026-06-12",
                Capacity = 50
            }
        ];

        private readonly List<ItemIndexItem> _items =
        [
            new ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000001"),
                Type = "story",
                Icon = ResolveIcon("story"),
                Key = "MVP-1",
                Title = "Finalize multi-tenant authentication",
                Priority = "P1",
                Points = 8,
                SprintId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Status = "todo",
                Rank = 1
            },
            new ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000002"),
                Type = "task",
                Icon = ResolveIcon("task"),
                Key = "MVP-2",
                Title = "Add smoke tests for the customer portal",
                Priority = "P1",
                Points = 5,
                SprintId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Status = "done",
                Rank = 2
            },
            new ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000003"),
                Type = "bug",
                Icon = ResolveIcon("bug"),
                Key = "MVP-3",
                Title = "Fix invoice export failure",
                Priority = "P2",
                Points = 3,
                SprintId = null,
                Status = "backlog",
                Rank = 1
            },
            new ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000004"),
                Type = "spike",
                Icon = ResolveIcon("spike"),
                Key = "MVP-4",
                Title = "Evaluate approach for role-based dashboards",
                Priority = "P3",
                Points = 2,
                SprintId = null,
                Status = "backlog",
                Rank = 2
            }
        ];

        /// <summary>
        /// Retrieves the available sprints.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>The available sprints.</returns>
        protected override IEnumerable<SprintIndexItem> RetrieveSprints(IQuery<SprintIndexItem> query, IQueryContext context, IRequest request)
        {
            return _sprints.Select(x => new SprintIndexItem
            {
                Id = x.Id,
                Name = x.Name,
                Goal = x.Goal,
                Status = x.Status,
                Start = x.Start,
                End = x.End,
                Capacity = x.Capacity
            })
                .ToList();
        }

        /// <summary>
        /// Retrieves the available scrum items.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <returns>The available scrum items.</returns>
        protected override IEnumerable<ItemIndexItem> RetrieveItems(IQuery<ItemIndexItem> query, IQueryContext context, IRequest request)
        {
            return _items.Select(x => new ItemIndexItem
            {
                Id = x.Id,
                Type = x.Type,
                Icon = x.Icon,
                Key = x.Key,
                Title = x.Title,
                Priority = x.Priority,
                Points = x.Points,
                SprintId = x.SprintId,
                Status = x.Status,
                Rank = x.Rank
            })
                .ToList();
        }

        /// <summary>
        /// Creates a sprint in the in-memory test store.
        /// </summary>
        /// <param name="payload">The sprint payload.</param>
        /// <param name="request">The request.</param>
        /// <param name="newSprint">The created sprint.</param>
        /// <returns>The creation result.</returns>
        protected override IRestApiCrudResultCreate CreateSprint(RestApiSprintPayload payload, IRequest request, out SprintIndexItem newSprint)
        {
            newSprint = new SprintIndexItem
            {
                Id = Guid.TryParse(payload.Id, out var sprintId) ? sprintId : Guid.NewGuid(),
                Name = payload.Name ?? string.Empty,
                Goal = payload.Goal ?? string.Empty,
                Status = string.IsNullOrWhiteSpace(payload.Status) ? "planned" : payload.Status,
                Start = payload.Start,
                End = payload.End,
                Capacity = payload.Capacity ?? 0
            };

            _sprints.Add(newSprint);

            if (string.Equals(newSprint.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                CloseOtherActiveSprintsInStore(_sprints, newSprint.Id);
            }

            return new RestApiCrudResultCreate()
            {
                Data = ToRestSprint(newSprint)
            };
        }

        /// <summary>
        /// Updates a sprint in the in-memory test store.
        /// </summary>
        /// <param name="existingSprint">The existing sprint.</param>
        /// <param name="payload">The sprint payload.</param>
        /// <param name="request">The request.</param>
        /// <returns>The update result.</returns>
        protected override IRestApiCrudResultUpdate UpdateSprint(SprintIndexItem existingSprint, RestApiSprintPayload payload, IRequest request)
        {
            var sprint = _sprints.First(x => x.Id == existingSprint.Id);

            sprint.Name = payload.Name ?? sprint.Name;
            sprint.Goal = payload.Goal ?? sprint.Goal;
            sprint.Status = string.IsNullOrWhiteSpace(payload.Status) ? sprint.Status : payload.Status;
            sprint.Start = payload.Start ?? sprint.Start;
            sprint.End = payload.End ?? sprint.End;
            sprint.Capacity = payload.Capacity ?? sprint.Capacity;

            if (string.Equals(sprint.Status, "active", StringComparison.OrdinalIgnoreCase))
            {
                CloseOtherActiveSprintsInStore(_sprints, sprint.Id);
            }

            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Moves an item in the in-memory test store.
        /// </summary>
        /// <param name="existingItem">The existing item.</param>
        /// <param name="payload">The move payload.</param>
        /// <param name="request">The request.</param>
        /// <returns>The update result.</returns>
        protected override IRestApiCrudResultUpdate MoveItem(ItemIndexItem existingItem, RestApiScrumMovePayload payload, IRequest request)
        {
            var item = _items.First(x => x.Id == existingItem.Id);
            var previousSprintId = item.SprintId;
            var targetSprintId = NormalizeSprintId(payload.SprintId);

            if (targetSprintId is not null && !_sprints.Any(x => x.Id == targetSprintId))
            {
                throw new InvalidOperationException("Target sprint not found.");
            }

            item.SprintId = targetSprintId;
            item.Status = targetSprintId is null
                ? "backlog"
                : string.Equals(item.Status, "backlog", StringComparison.OrdinalIgnoreCase) ? "todo" : item.Status;

            var targetItems = _items
                .Where(x => x.SprintId == targetSprintId && x.Id != item.Id)
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            targetItems.Add(item);
            NormalizeRanksInStore(_items, previousSprintId);
            RewriteRanksInStore(targetItems, targetSprintId);

            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Reorders an item in the in-memory test store.
        /// </summary>
        /// <param name="existingItem">The existing item.</param>
        /// <param name="payload">The rank payload.</param>
        /// <param name="request">The request.</param>
        /// <returns>The update result.</returns>
        protected override IRestApiCrudResultUpdate RankItem(ItemIndexItem existingItem, RestApiScrumRankPayload payload, IRequest request)
        {
            var item = _items.First(x => x.Id == existingItem.Id);
            var sprintId = NormalizeSprintId(payload.SprintId) ?? item.SprintId;

            if (sprintId is not null && !_sprints.Any(x => x.Id == sprintId))
            {
                throw new InvalidOperationException("Target sprint not found.");
            }

            var previousSprintId = item.SprintId;
            item.SprintId = sprintId;

            var rankedItems = _items
                .Where(x => x.Id != item.Id && x.SprintId == sprintId)
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            var index = Math.Clamp(payload.Rank ?? 1, 1, rankedItems.Count + 1) - 1;
            rankedItems.Insert(index, item);
            RewriteRanksInStore(rankedItems, sprintId);

            if (previousSprintId != sprintId)
            {
                NormalizeRanksInStore(_items, previousSprintId);
            }

            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Deletes a sprint from the in-memory test store.
        /// </summary>
        /// <param name="existingSprint">The existing sprint.</param>
        /// <param name="request">The request.</param>
        /// <returns>The delete result.</returns>
        protected override IRestApiCrudResultDelete DeleteSprint(SprintIndexItem existingSprint, IRequest request)
        {
            var sprint = _sprints.First(x => x.Id == existingSprint.Id);

            _sprints.Remove(sprint);

            foreach (var item in _items.Where(x => x.SprintId == sprint.Id))
            {
                item.SprintId = null;
                item.Status = "backlog";
            }

            NormalizeRanksInStore(_items, sprint.Id);
            NormalizeRanksInStore(_items, null);

            return new RestApiCrudResultDelete();
        }

        /// <summary>
        /// Resolves the icon class name corresponding to a specified item type.
        /// </summary>
        /// <param name="type">
        /// The type of the item for which to resolve the icon. If null 
        /// or empty, a default icon is returned.
        /// </param>
        /// <returns>
        /// A string containing the CSS class name for the icon associated with
        /// the specified type. Returns a default icon class if the type is
        /// unrecognized.</returns>
        private static string ResolveIcon(string type)
        {
            return (type ?? string.Empty).ToLowerInvariant() switch
            {
                "story" => "fas fa-bookmark",
                "task" => "fas fa-check",
                "bug" => "fas fa-bug",
                "spike" => "fas fa-bolt",
                _ => "fas fa-circle"
            };
        }

        protected override RestApiScrumSprintItem ToRestSprint(SprintIndexItem sprint)
        {
            return new RestApiScrumSprintItem
            {
                Id = sprint.Id.ToString(),
                Name = sprint.Name,
                Goal = sprint.Goal,
                Status = sprint.Status,
                Start = sprint.Start,
                End = sprint.End,
                Capacity = sprint.Capacity
            };
        }

        protected override RestApiScrumItem ToRestItem(ItemIndexItem item)
        {
            return new RestApiScrumItem
            {
                Id = item.Id.ToString(),
                Type = item.Type,
                Icon = item.Icon,
                Key = item.Key,
                Title = item.Title,
                Priority = item.Priority,
                Points = item.Points,
                SprintId = item.SprintId?.ToString(),
                Status = item.Status,
                Rank = item.Rank
            };
        }

        private static void CloseOtherActiveSprintsInStore(IEnumerable<SprintIndexItem> sprints, Guid activeSprintId)
        {
            foreach (var sprint in sprints.Where(x => x.Id != activeSprintId))
            {
                if (string.Equals(sprint.Status, "active", StringComparison.OrdinalIgnoreCase))
                {
                    sprint.Status = "closed";
                }
            }
        }

        private static void NormalizeRanksInStore(IEnumerable<ItemIndexItem> items, Guid? sprintId)
        {
            var orderedItems = items
                .Where(x => x.SprintId == sprintId)
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            RewriteRanksInStore(orderedItems, sprintId);
        }

        private static void RewriteRanksInStore(IReadOnlyList<ItemIndexItem> orderedItems, Guid? sprintId)
        {
            for (var i = 0; i < orderedItems.Count; i++)
            {
                orderedItems[i].SprintId = sprintId;
                orderedItems[i].Rank = i + 1;
            }
        }

        public sealed class SprintIndexItem : IIndexItem
        {
            public Guid Id { get; set; }
            public string Name { get; set; }
            public string Goal { get; set; }
            public string Status { get; set; }
            public string Start { get; set; }
            public string End { get; set; }
            public int Capacity { get; set; }
        }

        public sealed class ItemIndexItem : IIndexItem
        {
            public Guid Id { get; set; }
            public string Type { get; set; }
            public string Icon { get; set; }
            public string Key { get; set; }
            public string Title { get; set; }
            public string Priority { get; set; }
            public int Points { get; set; }
            public Guid? SprintId { get; set; }
            public string Status { get; set; }
            public int Rank { get; set; }
        }
    }
}
