COPY (SELECT "data" FROM "execution_data" ORDER BY "executionId" DESC LIMIT 1) TO '/tmp/execution_last.txt';
