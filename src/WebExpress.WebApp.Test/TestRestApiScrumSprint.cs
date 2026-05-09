using System;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a concrete test implementation of the sprint overview REST API.
    /// </summary>
    public sealed class TestRestApiScrumSprint : RestApiScrumSprint<TestRestApiScrum.SprintIndexItem, TestRestApiScrum.ItemIndexItem>
    {
        private readonly List<TestRestApiScrum.SprintIndexItem> _sprints =
        [
            new TestRestApiScrum.SprintIndexItem
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Name = "Sprint 24",
                Goal = "Customer-Portal MVP launch-ready",
                Status = "active",
                Start = "2026-04-29",
                End = "2026-05-13",
                Capacity = 60
            },
            new TestRestApiScrum.SprintIndexItem
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000002"),
                Name = "Sprint 25",
                Goal = "Improve self-service onboarding",
                Status = "planned",
                Start = "2026-05-14",
                End = "2026-05-28",
                Capacity = 55
            },
            new TestRestApiScrum.SprintIndexItem
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

        private readonly List<TestRestApiScrum.ItemIndexItem> _items =
        [
            new TestRestApiScrum.ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000001"),
                Type = "story",
                Icon = "fas fa-bookmark",
                Key = "MVP-1",
                Title = "Finalize multi-tenant authentication",
                Priority = "P1",
                Points = 8,
                SprintId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Status = "todo",
                Rank = 1
            },
            new TestRestApiScrum.ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000002"),
                Type = "task",
                Icon = "fas fa-check",
                Key = "MVP-2",
                Title = "Add smoke tests for the customer portal",
                Priority = "P1",
                Points = 5,
                SprintId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Status = "done",
                Rank = 2
            },
            new TestRestApiScrum.ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000003"),
                Type = "bug",
                Icon = "fas fa-bug",
                Key = "MVP-3",
                Title = "Fix invoice export failure",
                Priority = "P2",
                Points = 3,
                SprintId = null,
                Status = "backlog",
                Rank = 1
            },
            new TestRestApiScrum.ItemIndexItem
            {
                Id = Guid.Parse("20000000-0000-0000-0000-000000000004"),
                Type = "spike",
                Icon = "fas fa-bolt",
                Key = "MVP-4",
                Title = "Evaluate approach for role-based dashboards",
                Priority = "P3",
                Points = 2,
                SprintId = null,
                Status = "backlog",
                Rank = 2
            }
        ];

        protected override IEnumerable<TestRestApiScrum.SprintIndexItem> RetrieveSprints(IQuery<TestRestApiScrum.SprintIndexItem> query, IQueryContext context, IRequest request)
        {
            return _sprints.Select(x => new TestRestApiScrum.SprintIndexItem
            {
                Id = x.Id,
                Name = x.Name,
                Goal = x.Goal,
                Status = x.Status,
                Start = x.Start,
                End = x.End,
                Capacity = x.Capacity
            }).ToList();
        }

        protected override IEnumerable<TestRestApiScrum.ItemIndexItem> RetrieveItems(IQuery<TestRestApiScrum.ItemIndexItem> query, IQueryContext context, IRequest request)
        {
            return _items.Select(x => new TestRestApiScrum.ItemIndexItem
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
            }).ToList();
        }

        protected override RestApiScrumSprintItem ToRestSprint(TestRestApiScrum.SprintIndexItem sprint)
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

        protected override RestApiScrumItem ToRestItem(TestRestApiScrum.ItemIndexItem item)
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
    }
}
