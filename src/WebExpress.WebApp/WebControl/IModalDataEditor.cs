using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that edits one document - a title and a rich-text body - and separates
    /// the two things a single save button normally has to pretend are one: <i>do not lose what
    /// I have written</i> and <i>let the readers see this</i>. Every change is written into an
    /// unpublished draft while the author types; the submit publishes.
    /// </summary>
    /// <remarks>
    /// The two meanings of save are two endpoints. The record service loads the values the
    /// editor opens on and applies them on publish; the draft service stores, answers and drops
    /// the unpublished text. Without a declared draft service the control degrades to an
    /// ordinary edit form, which is why every draft-bound member is optional.
    /// </remarks>
    public interface IModalDataEditor : IControlForm, IDataIsland
    {
        /// <summary>
        /// Gets the input for the document's name. It is rendered into the form's header, which
        /// the modal controller lifts onto the dialog's title bar, so the document is titled
        /// where the dialog needs a title anyway.
        /// </summary>
        ControlFormItemInputText Title { get; }

        /// <summary>
        /// Gets the input for the document's rich-text body. It is the only form item and takes
        /// the whole content area, because the writing surface is the work.
        /// </summary>
        ControlFormItemInputText Body { get; }

        /// <summary>
        /// Gets or sets the resolver of the draft service descriptor, declared through
        /// DraftService&lt;TEndpoint&gt;(). Left null, the control saves nothing on its own and
        /// behaves exactly like an ordinary edit form.
        /// </summary>
        Func<IRenderControlContext, DataServiceDescriptor> DraftServiceFactory { get; set; }

        /// <summary>
        /// Gets or sets the resolver deciding whether the surface drafts at all. Turned off, it
        /// saves once, on submit, and the button reads save beside the dialog's cancel - which is
        /// the honest reading for a document nobody may hold an unpublished version of.
        /// </summary>
        Func<IRenderControlContext, bool> Draft { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the idle time in milliseconds after which a change is
        /// written to the draft.
        /// </summary>
        Func<IRenderControlContext, uint> Debounce { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the time in milliseconds after which a change is written
        /// however continuous the typing is, so a long paragraph is not held hostage to the
        /// pause that never comes.
        /// </summary>
        Func<IRenderControlContext, uint> MaxDelay { get; set; }

        /// <summary>
        /// Gets or sets the resolver deciding whether the save state is legible. Turned off, the
        /// indicator still carries the autosave, it just says nothing.
        /// </summary>
        Func<IRenderControlContext, bool> ShowState { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the dialog size. A document defaults to fullscreen,
        /// because a measure that fits a form does not fit a text.
        /// </summary>
        Func<IRenderControlContext, TypeModalSize> Size { get; set; }

        /// <summary>
        /// Gets or sets the label of the dialog's close button.
        /// </summary>
        Func<IRenderControlContext, string> CloseLabel { get; set; }

        /// <summary>
        /// Gets or sets the resolver deciding whether the dialog opens with the page, rather than
        /// waiting for a trigger that addresses its id.
        /// </summary>
        Func<IRenderControlContext, bool> Show { get; set; }

        /// <summary>
        /// Gets or sets the resolver deciding whether the writing surface is shared, so two
        /// authors in the same document see each other's presence, pointers, carets and text.
        /// </summary>
        Func<IRenderControlContext, bool> Collaborative { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the collaboration channel. The id <b>is</b> the routing
        /// channel: everybody editing the same document has to be given the same one and nobody
        /// else may be, because a drifted id fails silently as "nobody else is here".
        /// </summary>
        Func<IRenderControlContext, string> CollaborationId { get; set; }

        /// <summary>
        /// Gets the entries the host adds to the overflow menu beside the control's own discard,
        /// for example a view of what publishing would change.
        /// </summary>
        IList<IControlDropdownItem> MoreItems { get; }
    }
}
