delete from auth_identity where "userId" = 'e43ef5d5-3116-4fce-a38e-3274d2b8f9c1';
insert into auth_identity ("userId", "providerId", "providerType", "createdAt", "updatedAt")
values ('e43ef5d5-3116-4fce-a38e-3274d2b8f9c1', 'provider@example.com', 'email', current_timestamp, current_timestamp);
