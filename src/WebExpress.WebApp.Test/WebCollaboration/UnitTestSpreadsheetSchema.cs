using System.Text.Json.Nodes;
using WebExpress.WebApp.WebCollaboration;

namespace WebExpress.WebApp.Test.WebCollaboration
{
    /// <summary>
    /// Tests the schema of shared workbooks. The cases mirror spreadsheet.collab.test.mjs, which
    /// checks the same documents against SpreadsheetCollab.check on the client: both ends must
    /// accept exactly the same workbooks.
    /// </summary>
    public class UnitTestSpreadsheetSchema
    {
        private const string Book = "{\"t\":\"l\",\"n\":\"book\",\"id\":\"book\",\"a\":{\"order\":[\"s1\"]}}";
        private const string Sheet = "{\"t\":\"l\",\"n\":\"sheet\",\"id\":\"s1\",\"a\":{\"name\":\"S\"}}";
        private const string Col = "{\"t\":\"l\",\"n\":\"col\",\"id\":\"c1\",\"a\":{}}";
        private const string Row = "{\"t\":\"l\",\"n\":\"row\",\"id\":\"r1\",\"a\":{\"c1\":{\"v\":1,\"f\":\"=@{\\\"s\\\":\\\"s1\\\"}\"},\"_p\":{\"size\":30}}}";

        /// <summary>
        /// Checks a document given as packed tokens.
        /// </summary>
        /// <param name="tokens">The tokens as JSON array items.</param>
        /// <returns>True if the schema accepts the document.</returns>
        private static bool Check(params string[] tokens)
        {
            return new SpreadsheetSchema().Validate(OtDocument.Expand(JsonNode.Parse("[" + string.Join(",", tokens) + "]")), out _);
        }

        /// <summary>
        /// Tests the document kind.
        /// </summary>
        [Fact]
        public void KindIsSpreadsheet()
        {
            Assert.Equal("spreadsheet", new SpreadsheetSchema().Kind);
        }

        /// <summary>
        /// Tests that a complete workbook is accepted.
        /// </summary>
        [Fact]
        public void CompleteWorkbookIsAccepted()
        {
            Assert.True(Check(Book, Sheet, Col, Row));
            Assert.True(Check(Book, Sheet, Col, Row, Sheet.Replace("s1", "s2").Replace("\"S\"", "\"T\""), Col.Replace("c1", "c2"), Row.Replace("r1", "r2")));
        }

        /// <summary>
        /// Tests the structural rules: book first, complete sections, unique ids and names.
        /// </summary>
        [Fact]
        public void StructureIsEnforced()
        {
            Assert.False(Check(Sheet, Col, Row), "the book leaf comes first");
            Assert.False(Check(Book), "a workbook has a sheet");
            Assert.False(Check(Book, Sheet, Row), "rows follow columns");
            Assert.False(Check(Book, Sheet, Col), "a sheet has a row");
            Assert.False(Check(Book, Sheet, Col, Row, Col.Replace("c1", "c2")), "columns precede rows");
            Assert.False(Check(Book, Sheet, Col, Row, Sheet.Replace("s1", "s2").Replace("\"S\"", "\"s\""), Col, Row), "sheet names are unique case-insensitively");
            Assert.False(Check(Book, Sheet, Col, Row, Row), "ids are unique");
            Assert.False(Check(Book, Col), "a column belongs to a sheet");
            Assert.False(Check(Book, Sheet, Col, "{\"t\":\"l\",\"n\":\"other\",\"id\":\"x\",\"a\":{}}"));
            Assert.False(Check(Book, Sheet, Col, "{\"t\":\"s\",\"v\":\"x\"}"));
            Assert.False(Check(Book.Replace("[\"s1\"]", "[1]"), Sheet, Col, Row));
            Assert.False(Check(Book, Sheet.Replace("\"S\"", "\"a/b\""), Col, Row));
            Assert.False(Check(Book, Sheet.Replace("\"id\":\"s1\"", "\"id\":\"bad id\""), Col, Row));
        }

        /// <summary>
        /// Tests the rules for cells and attribute values.
        /// </summary>
        [Fact]
        public void CellsAreBoundedData()
        {
            Assert.False(Check(Book, Sheet, Col, "{\"t\":\"l\",\"n\":\"row\",\"id\":\"r1\",\"a\":{\"c1\":{\"x\":1}}}"), "cells hold known fields only");
            Assert.False(Check(Book, Sheet, Col, "{\"t\":\"l\",\"n\":\"row\",\"id\":\"r1\",\"a\":{\"c1\":[1]}}"));
            Assert.False(Check(Book, Sheet, Col, "{\"t\":\"l\",\"n\":\"row\",\"id\":\"r1\",\"a\":{\"bad key\":{\"v\":1}}}"));
            Assert.False(Check(Book, Sheet, Col.Replace("{}", "{\"p\":{\"s\":{\"x\":\"" + new string('y', 40000) + "\"}}}"), Row), "strings are bounded");
            Assert.True(Check(Book, Sheet, Col, "{\"t\":\"l\",\"n\":\"row\",\"id\":\"r1\",\"a\":{\"c1\":{\"v\":{\"href\":\"x\",\"text\":\"y\"},\"t\":\"link\",\"s\":{\"border\":{\"top\":\"thin\"}},\"c\":{\"text\":\"n\"},\"m\":{\"options\":[\"a\"]}}}}"));
        }
    }
}
