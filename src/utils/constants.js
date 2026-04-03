export const UserRoleEnum = {
    ADMIN : "admin",
    PROJECT_ADMIN : "project_admin",
    MEMBER : "member"
}

export const AvailableRoles = Object.values(UserRoleEnum)
export const TaskStatusEnum = {
    TODO : "To Do",
    IN_PROGRESS : "In Progress",
    DONE : "Done"
}

export const AvailableTaskStatuses = Object.values(TaskStatusEnum)