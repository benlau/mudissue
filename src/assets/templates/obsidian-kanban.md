---
kanban-plugin: board
---

<% columns.forEach(function(column) { %>
## <%= column.title %>

<% column.cards.forEach(function(card) { %>
- [ ] <%- card.wikiLink %>
<% }); %>

<% }); %>
%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":<%- JSON.stringify(listCollapse) %>}
```
%%
