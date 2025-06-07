//using System;
//using WebExpress.WebCore.WebComponent;
//using WebExpress.WebCore.WebHtml;
//using WebExpress.WebCore.WebPage;
//using WebExpress.WebUI.WebControl;

//namespace WebExpress.WebApp.WebApiControl
//{
//    /// <summary>
//    /// Task progress bar.
//    /// </summary>
//    public class ControlApiProgressBarTaskState : ControlProgressBar
//    {
//        /// <summary>
//        /// Returns or sets the Java script function, which is called when the task is completed.
//        /// </summary>
//        public string OnFinishScript { get; set; }

//        /// <summary>
//        /// Initializes a new instance of the class.
//        /// </summary>
//        /// <param name="id">The control id.</param>
//        public ControlApiProgressBarTaskState(string id)
//            : base(id ?? Guid.NewGuid().ToString())
//        {
//        }

//        /// <summary>
//        /// Convert to html.
//        /// </summary>
//        /// <param name="context">The context in which the control is rendered.</param>
//        /// <returns>The control as html.</returns>
//        public override IHtmlNode Render(RenderContext context)
//        {
//            var module = ComponentManager.ModuleManager.GetModule(context.ApplicationContext, typeof(Module));
//            var code = $"updateTaskProgressBar('{Id}', '{module?.ContextPath.Append("api/v1/taskstatus")}', {OnFinishScript});";

//            context.VisualTree.AddScript("webexpress.webapp:controlapiprogressbartaskstate", code);


//            return base.Render(context);
//        }
//    }
//}
