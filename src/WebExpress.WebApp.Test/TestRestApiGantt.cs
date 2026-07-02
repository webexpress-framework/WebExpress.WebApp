using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of the gantt REST API, backed by an
    /// in-memory store, so the sub-path routing, payload parsing and the
    /// mutation hooks of the base class can be exercised end to end.
    /// </summary>
    public class TestRestApiGantt : RestApiGantt
    {
        private readonly List<RestApiGanttTask> _tasks = [];
        private readonly List<RestApiGanttLink> _links = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="title">The title of the plan.</param>
        public TestRestApiGantt(string title = "gantt_title")
        {
            Title = title;
        }

        /// <summary>
        /// Gets the current tasks of the in-memory store.
        /// </summary>
        public IReadOnlyList<RestApiGanttTask> Tasks => _tasks;

        /// <summary>
        /// Gets the current links of the in-memory store.
        /// </summary>
        public IReadOnlyList<RestApiGanttLink> Links => _links;

        /// <summary>
        /// Seeds the store with the given tasks and links.
        /// </summary>
        /// <param name="tasks">The tasks.</param>
        /// <param name="links">The links.</param>
        public void Seed(IEnumerable<RestApiGanttTask> tasks, IEnumerable<RestApiGanttLink> links)
        {
            _tasks.AddRange(tasks);
            _links.AddRange(links);
        }

        /// <inheritdoc/>
        protected override IEnumerable<RestApiGanttTask> RetrieveTasks(IRequest request)
        {
            return _tasks;
        }

        /// <inheritdoc/>
        protected override IEnumerable<RestApiGanttLink> RetrieveLinks(IRequest request)
        {
            return _links;
        }

        /// <inheritdoc/>
        protected override RestApiGanttTask CreateTask(RestApiGanttTask task, IRequest request)
        {
            task.Id ??= "srv-t" + (_tasks.Count + 1);
            _tasks.Add(task);

            return task;
        }

        /// <inheritdoc/>
        protected override RestApiGanttTask UpdateTask(string id, RestApiGanttTask task, IRequest request)
        {
            var existing = _tasks.FirstOrDefault(x => x.Id == id);
            if (existing is null)
            {
                return null;
            }

            existing.Label = task.Label;
            existing.Start = task.Start;
            existing.End = task.End;
            existing.Duration = task.Duration;
            existing.Progress = task.Progress;
            existing.Resources = task.Resources;
            existing.ParentId = task.ParentId;
            existing.Icon = task.Icon;

            return existing;
        }

        /// <inheritdoc/>
        protected override bool DeleteTask(string id, IRequest request)
        {
            if (!_tasks.Any(x => x.Id == id))
            {
                return false;
            }

            var removed = new HashSet<string> { id };
            var grown = true;
            while (grown)
            {
                grown = false;
                foreach (var candidate in _tasks)
                {
                    if (candidate.ParentId is not null && removed.Contains(candidate.ParentId) && removed.Add(candidate.Id))
                    {
                        grown = true;
                    }
                }
            }

            _tasks.RemoveAll(x => removed.Contains(x.Id));
            _links.RemoveAll(x => removed.Contains(x.From) || removed.Contains(x.To));

            return true;
        }

        /// <inheritdoc/>
        protected override RestApiGanttLink CreateLink(RestApiGanttLink link, IRequest request)
        {
            link.Id ??= "srv-l" + (_links.Count + 1);
            link.Type = string.IsNullOrWhiteSpace(link.Type) ? "FS" : link.Type;
            _links.Add(link);

            return link;
        }

        /// <inheritdoc/>
        protected override bool DeleteLink(string id, IRequest request)
        {
            return _links.RemoveAll(x => x.Id == id) > 0;
        }
    }
}
