using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The family presets of the fluent data authoring surface. Each data
    /// control family already owns a canonical service shape (its historical
    /// query parameter and response names, shared with the JavaScript
    /// legacyDescriptor), so declaring the standard service takes a single
    /// typed call: the endpoint type is the only thing the page contributes,
    /// and it is resolved through the sitemap at render time. No wire name is
    /// spelled at the call site.
    ///
    /// <code>
    /// new ControlDataList("orders")
    ///     .State(s => s.Page(0).PageSize(25))
    ///     .DataService&lt;OrderRestApi&gt;();
    /// </code>
    ///
    /// The optional configure callback adjusts the preset, for example with
    /// MapError or WithRetry, and the generic Service extension stays available
    /// for fully bespoke contracts.
    /// </summary>
    public static class ControlDataAuthoringExtensions
    {
        /// <summary>
        /// Declares the standard data service of the list, which queries with
        /// GET and carries the historical list parameter and response names.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The list control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataList DataService<TEndpoint>(this ControlDataList control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.ListData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the table, which queries with
        /// GET, persists a reordered row set with PUT and carries the
        /// historical table parameter and response names.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The table control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTable DataService<TEndpoint>(this ControlDataTable control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.TableData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the tab, which loads with GET,
        /// persists with PUT, maps the logical id parameter and projects the
        /// items response.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The tab control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTab DataService<TEndpoint>(this ControlDataTab control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.TabData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the kanban board, which loads
        /// its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The kanban control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataKanban DataService<TEndpoint>(this ControlDataKanban control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the gantt chart, which loads
        /// the project with GET and persists task and link mutations against
        /// the same base.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The gantt control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataGantt DataService<TEndpoint>(this ControlDataGantt control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the dashboard, which loads its
        /// state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The dashboard control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataDashboard DataService<TEndpoint>(this ControlDataDashboard control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the tile panel, which loads
        /// its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The tile control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTile DataService<TEndpoint>(this ControlDataTile control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the comment surface, which
        /// loads its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The comment control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataComment DataService<TEndpoint>(this ControlDataComment control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the scrum backlog, which loads
        /// its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The scrum backlog control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumBacklog DataService<TEndpoint>(this ControlDataScrumBacklog control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the workflow editor, which
        /// loads its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The workflow control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataWorkflow DataService<TEndpoint>(this ControlDataWorkflow control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the remote dropdown, which
        /// queries its items with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The dropdown control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataDropdown DataService<TEndpoint>(this ControlDataDropdown control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the data sidebar, which queries
        /// its navigation tree with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The sidebar control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataSidebar DataService<TEndpoint>(this ControlDataSidebar control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the avatar dropdown, which
        /// queries its items with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The avatar dropdown control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataAvatarDropdown DataService<TEndpoint>(this ControlDataAvatarDropdown control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the theme picker, which loads
        /// the theme list with GET and persists the selection with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The theme picker control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataSelectionTheme DataService<TEndpoint>(this ControlDataSelectionTheme control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the login form, which submits
        /// the credentials with POST.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The login control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataLogin DataService<TEndpoint>(this ControlDataLogin control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.SubmitData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the tag surface, which loads
        /// and suggests with GET; additions and deletions shape their own
        /// requests against the same base.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The tag control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTag DataService<TEndpoint>(this ControlDataTag control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the traffic light surface, which
        /// loads the current status with GET and persists a change with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The traffic light control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTrafficLight DataService<TEndpoint>(this ControlDataTrafficLight control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the watcher surface, which
        /// loads with GET; additions and removals shape their own requests
        /// against the same base.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The watcher control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataWatcher DataService<TEndpoint>(this ControlDataWatcher control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the users service of the watcher surface, which resolves
        /// the candidate users with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The watcher control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataWatcher UsersService<TEndpoint>(this ControlDataWatcher control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, UsersPreset, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the users service of the scrum backlog, which resolves the
        /// candidate assignees with GET when an item is assigned.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The scrum backlog control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumBacklog UsersService<TEndpoint>(this ControlDataScrumBacklog control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, UsersPreset, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the users service of the comment surface, which resolves
        /// mentioned users with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The comment control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataComment UsersService<TEndpoint>(this ControlDataComment control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, UsersPreset, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the image upload service of the comment surface, which
        /// posts inline images.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The comment control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataComment UploadService<TEndpoint>(this ControlDataComment control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, UploadPreset, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the users service of the comment composer, which resolves
        /// mentioned users with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The composer control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataCommentComposer UsersService<TEndpoint>(this ControlDataCommentComposer control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, UsersPreset, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the image upload service of the comment composer, which
        /// posts inline images.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The composer control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataCommentComposer UploadService<TEndpoint>(this ControlDataCommentComposer control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, UploadPreset, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the comment composer, which
        /// posts the new comment against the comments endpoint.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The composer control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataCommentComposer DataService<TEndpoint>(this ControlDataCommentComposer control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the quickfilter, which loads
        /// the filter definitions with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The quickfilter control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataQuickfilter DataService<TEndpoint>(this ControlDataQuickfilter control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the WQL prompt, which queries
        /// suggestions, analysis and history with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The prompt control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataWqlPrompt DataService<TEndpoint>(this ControlDataWqlPrompt control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the advanced search, which
        /// backs the embedded WQL prompt with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The search control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlAdvancedSearch DataService<TEndpoint>(this ControlAdvancedSearch control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the rest form, which shapes
        /// its own load and submit requests against the endpoint.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The form control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataForm DataService<TEndpoint>(this ControlDataForm control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.FormData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the wizard, which shapes its
        /// own step and submit requests against the endpoint.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The wizard control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataWizard DataService<TEndpoint>(this ControlDataWizard control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.FormData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the form editor, which loads
        /// and persists the form definition against the endpoint.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The form editor control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataFormEditor DataService<TEndpoint>(this ControlDataFormEditor control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.FormData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the uniqueness input, which
        /// validates the value with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The input control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataFormItemInputUnique DataService<TEndpoint>(this ControlDataFormItemInputUnique control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the selection input, which
        /// queries its items with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The input control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataFormItemInputSelection DataService<TEndpoint>(this ControlDataFormItemInputSelection control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the cascading input, which
        /// queries the root level with GET and the children of a selected node
        /// on demand via the parent query parameter.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The input control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataFormItemInputCascading DataService<TEndpoint>(this ControlDataFormItemInputCascading control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the check input, which reads
        /// and toggles the state against the endpoint.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The input control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataFormItemInputCheck DataService<TEndpoint>(this ControlDataFormItemInputCheck control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the scrum sprint card, which
        /// loads the sprint with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The sprint control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumSprint DataService<TEndpoint>(this ControlDataScrumSprint control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the scrum team workload surface,
        /// which loads the current sprint's people and their story points with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The scrum team control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumTeam DataService<TEndpoint>(this ControlDataScrumTeam control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the scrum velocity chart, which
        /// loads the recent sprints with their committed and completed story
        /// points with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The scrum velocity control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumVelocity DataService<TEndpoint>(this ControlDataScrumVelocity control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the table rest selection
        /// template, which queries the selectable items with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The template control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlTableTemplateRestSelection DataService<TEndpoint>(this ControlTableTemplateRestSelection control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the table rest combo template,
        /// which queries the selectable options with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The template control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlTableTemplateRestCombo DataService<TEndpoint>(this ControlTableTemplateRestCombo control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the table rest tag template, which
        /// serves autocomplete suggestions with GET.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The template control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlTableTemplateRestTag DataService<TEndpoint>(this ControlTableTemplateRestTag control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.QueryData, Endpoint<TEndpoint>(), Domains<TEndpoint>(), configure);
        }

        /// <summary>
        /// Binds the list to a scope resource by type, fluently and preserving
        /// the concrete control type. A single generic extension on IScopeBound
        /// could not keep the concrete type (C# allows neither mixing one
        /// inferred and one explicit type argument), so the binding is declared
        /// per control family, mirroring the DataService presets.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The list control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataList Resource<TResource>(this ControlDataList control) where TResource : IDataResource
            => BindResource<ControlDataList, TResource>(control);

        /// <summary>
        /// Binds the table to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The table control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTable Resource<TResource>(this ControlDataTable control) where TResource : IDataResource
            => BindResource<ControlDataTable, TResource>(control);

        /// <summary>
        /// Binds the tile panel to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The tile control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTile Resource<TResource>(this ControlDataTile control) where TResource : IDataResource
            => BindResource<ControlDataTile, TResource>(control);

        /// <summary>
        /// Binds the kanban board to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The kanban control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataKanban Resource<TResource>(this ControlDataKanban control) where TResource : IDataResource
            => BindResource<ControlDataKanban, TResource>(control);

        /// <summary>
        /// Binds the gantt chart to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The gantt control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataGantt Resource<TResource>(this ControlDataGantt control) where TResource : IDataResource
            => BindResource<ControlDataGantt, TResource>(control);

        /// <summary>
        /// Binds the dashboard to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The dashboard control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataDashboard Resource<TResource>(this ControlDataDashboard control) where TResource : IDataResource
            => BindResource<ControlDataDashboard, TResource>(control);

        /// <summary>
        /// Binds the tab set to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The tab control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTab Resource<TResource>(this ControlDataTab control) where TResource : IDataResource
            => BindResource<ControlDataTab, TResource>(control);

        /// <summary>
        /// Binds the comment surface to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The comment control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataComment Resource<TResource>(this ControlDataComment control) where TResource : IDataResource
            => BindResource<ControlDataComment, TResource>(control);

        /// <summary>
        /// Binds the scrum backlog to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The scrum backlog control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumBacklog Resource<TResource>(this ControlDataScrumBacklog control) where TResource : IDataResource
            => BindResource<ControlDataScrumBacklog, TResource>(control);

        /// <summary>
        /// Binds the traffic light to a scope resource by type.
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The traffic light control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTrafficLight Resource<TResource>(this ControlDataTrafficLight control) where TResource : IDataResource
            => BindResource<ControlDataTrafficLight, TResource>(control);

        /// <summary>
        /// Binds the scrum backlog's users service by endpoint type, fluently and
        /// preserving the concrete control type.
        /// </summary>
        /// <typeparam name="TEndpoint">The users endpoint type.</typeparam>
        /// <param name="control">The scrum backlog control.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumBacklog UsersService<TEndpoint>(this ControlDataScrumBacklog control) where TEndpoint : IEndpoint
        {
            if (control != null)
            {
                control.UsersFactory = _ => DataTypeName.Of<TEndpoint>();
            }

            return control;
        }

        /// <summary>
        /// Sets the resource binding on a scope-bound control and returns the
        /// concrete control type, the shared body of the per family Resource
        /// overloads.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="control">The scope-bound control.</param>
        /// <returns>The control for chaining.</returns>
        private static T BindResource<T, TResource>(T control) where T : IScopeBound where TResource : IDataResource
        {
            if (control != null)
            {
                control.ResourceFactory = _ => DataTypeName.Of<TResource>();
            }

            return control;
        }

        /// <summary>
        /// The preset of the named users service, which resolves users with GET.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        private static DataServiceDescriptor UsersPreset(string baseUri)
        {
            return DataServiceDescriptor.Rest("users").WithBaseUri(baseUri).WithMethod("GET");
        }

        /// <summary>
        /// The preset of the named upload service, which posts inline images.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        private static DataServiceDescriptor UploadPreset(string baseUri)
        {
            return DataServiceDescriptor.Rest("upload").WithBaseUri(baseUri).WithMethod("POST");
        }

        /// <summary>
        /// Builds the endpoint resolver for an endpoint type. The route is
        /// resolved through the sitemap at render time, so routing stays
        /// authoritative in C#.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <returns>The resolver.</returns>
        private static Func<IRenderControlContext, string> Endpoint<TEndpoint>() where TEndpoint : IEndpoint
        {
            return renderContext => WebEx.ComponentHub.SitemapManager
                .GetUri<TEndpoint>(renderContext?.PageContext?.ApplicationContext)?.ToString();
        }

        /// <summary>
        /// Builds the domain derivation for an endpoint type, so a control
        /// authored through a family preset takes part in the live data
        /// updates without naming the domain a second time.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <returns>The wire names of the derived domains.</returns>
        private static IEnumerable<string> Domains<TEndpoint>() where TEndpoint : IEndpoint
        {
            return DataServiceBuilder.DeriveDomains(typeof(TEndpoint));
        }

        /// <summary>
        /// Adds a preset service factory to the control.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <param name="control">The data bound control.</param>
        /// <param name="preset">The family preset, receiving the resolved endpoint.</param>
        /// <param name="endpoint">The endpoint resolver.</param>
        /// <param name="domains">The wire names of the domains the endpoint serves.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        private static T AddPreset<T>(T control, Func<string, DataServiceDescriptor> preset, Func<IRenderControlContext, string> endpoint, IEnumerable<string> domains, Action<DataServiceDescriptor> configure)
            where T : IDataIsland
        {
            control.ServiceFactories.Add(renderContext =>
            {
                var descriptor = preset(endpoint(renderContext));

                foreach (var domain in domains)
                {
                    descriptor.WithDomain(domain);
                }

                configure?.Invoke(descriptor);
                return descriptor;
            });

            return control;
        }
    }
}
