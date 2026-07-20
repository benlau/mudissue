# Using MudIssue in Distributed Environments

MudIssue is designed primarily as a personal issue tracker. However, due to its lightweight architecture and use of Markdown for data storage, it is compatible with distributed environments. Whether you are synchronizing your tasks across multiple machines using Version Control Systems (VCS) like Git, or utilizing cloud storage services such as Dropbox and Google Drive, MudIssue provides a flexible foundation for cross-platform task management.

## Synchronization Strategies

Because MudIssue stores its data in plain Markdown files, you can leverage existing synchronization tools to keep your tracker up to date across different environments:

*   **Version Control Systems (VCS):** Using Git allows for granular control over changes, providing a history of modifications and the ability to resolve conflicts manually.
*   **Cloud Storage:** Services like Dropbox or Google Drive provide seamless, real-time synchronization of the tracker directory, ensuring that your issues are available on any device with access to those accounts.

## Managing Issue ID Uniqueness

Since MudIssue is serverless, it does not have a centralized authority to guarantee the uniqueness of issue numbers across different installations. In a distributed setup, there is a risk of "ID collisions"—where two different issues are assigned the same ID on different machines before they are synchronized.

### Recommended Strategy: Unique Prefixes

To prevent duplicate IDs in a multi-device or multi-user environment, we recommend implementing a **Unique Issue ID Prefix** for each node. 

Instead of using generic sequential numbers, assign a specific prefix based on the machine name or the user handling the task. For example:
*   **Computer A:** `CA`...
*   **Computer B:** `CB` ...
*   **User Ada:** `ADA`...
*   **User Ben:** `BEN`...

By segregating the ID namespace, you ensure that new issues created on different devices will never overlap. For more details on how prefixes work, see [Issue folder naming rules](../concept/issue-folder.md).

### Handling Collisions: The Change ID Feature

In the event that a duplicate ID is accidentally created and synchronized, it is important to note that **duplicated IDs will not damage the system**; the tracker remains functional. However, for organizational clarity and to avoid confusion, we recommend reassigning the ID. 

MudIssue provides a dedicated command for this purpose:
```bash
mud issue change-id
```

This allows you to manually update an issue number, resolving the conflict and maintaining the integrity of your tracking system.
