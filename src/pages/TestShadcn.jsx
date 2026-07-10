import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestShadcn() {
  return (
    <div className="p-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shadcn UI Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Firma adı giriniz..." />
          <Button>Kaydet</Button>
        </CardContent>
      </Card>
    </div>
  );
}
