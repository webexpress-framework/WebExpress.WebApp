namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// How many links of one type may meet at each end. The cardinality is
    /// enforced when a link is created, so a relation that is meaningful only
    /// once - an item is a duplicate of exactly one other item - cannot be
    /// established twice by two people working in parallel.
    /// </summary>
    public enum RelationCardinality
    {
        /// <summary>
        /// One link per source and per target, for example a document that
        /// replaces exactly one predecessor.
        /// </summary>
        OneToOne,

        /// <summary>
        /// One source may link many targets, each target only one source, for
        /// example a parent aggregating its children.
        /// </summary>
        OneToMany,

        /// <summary>
        /// Many sources may link the same target, each source only one target,
        /// for example many duplicates pointing at one original.
        /// </summary>
        ManyToOne,

        /// <summary>
        /// No restriction on either end, which is the default for a plain
        /// reference.
        /// </summary>
        ManyToMany
    }
}
