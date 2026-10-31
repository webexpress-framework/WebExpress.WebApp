namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The effect a link of a type has on the workflow of its source. The effect
    /// is declared on the type rather than evaluated per link, so the workflow
    /// can ask a single question - which of my links block me - without knowing
    /// the semantics of every registered relation.
    /// </summary>
    public enum RelationEffect
    {
        /// <summary>
        /// The link carries no workflow meaning and is purely informational.
        /// </summary>
        None,

        /// <summary>
        /// The source cannot reach a closing state while the target is open.
        /// </summary>
        BlocksCompletion,

        /// <summary>
        /// Closing the target closes the source as well, which is how a
        /// duplicate follows its original.
        /// </summary>
        ClosesItem,

        /// <summary>
        /// The progress of the targets is aggregated into the source, which is
        /// how a parent reports the state of its children.
        /// </summary>
        AggregatesProgress
    }
}
